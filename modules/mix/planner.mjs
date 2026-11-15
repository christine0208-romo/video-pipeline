import { existsSync } from "node:fs";
import path from "node:path";
import { findAssetFile } from "../lib/assets.mjs";
import { readJson, shortHash } from "../lib/fsx.mjs";
import { linkMusic } from "../lib/public.mjs";
import { makeRng, pick, shuffle } from "../lib/rng.mjs";
import { alignedHamming } from "../quality/similarity.mjs";

const MOTIONS = ["push", "pull", "panLeft", "panRight", "panUp", "panDown"];
const FOCUSES = [
  [0.5, 0.5],
  [0.35, 0.5],
  [0.65, 0.5],
  [0.5, 0.38],
  [0.5, 0.62],
  [0.3, 0.42],
  [0.7, 0.58],
];
const ZOOMS = [1.0, 1.05, 1.12, 1.2, 1.28];
const SPEEDS = [0.96, 1, 1.04];
const GRADES = [  {},
  { saturation: 1.08, contrast: 1.05 },
  { saturation: 0.92, contrast: 1.1 },
  { brightness: 0.92, saturation: 1.04 },
  { brightness: 1.04, contrast: 0.98 },
];
const round3 = (value) => Math.round(value * 1000) / 1000;

const isApproved = (entry, cfg) =>
  cfg.mix.allowDraft || (entry.status ?? "approved") === "approved";

const qualityAllowed = (entry, cfg) =>
  cfg.mix.allowLowQuality || entry.quality?.ok !== false;

function perceptualAllowed(entry, state) {
  if (state.cfg.mix.perceptualDedupe === false) return true;
  if (!entry.quality?.phashFrames?.length) return true;
  const distance = Number(state.cfg.quality?.clusterDistance ?? 12);
  for (const used of state.usedPerceptual) {
    if ((used.layer ?? "scene") !== (entry.layer ?? "scene")) continue;
    if (!used.quality?.phashFrames?.length) continue;
    if (
      alignedHamming(used.quality.phashFrames, entry.quality.phashFrames) <=
      distance
    ) {
      return false;
    }
  }
  return true;
}

const roleAllowed = (entry, role) =>
  !entry.beatRoles?.length || entry.beatRoles.includes(role);

const sceneEntry = (entry) =>
  entry.sceneCapable ?? (!entry.layer || entry.layer === "scene");

const overlayEntry = (entry) => entry.overlayCapable ?? Boolean(entry.alpha);

const transitionEntry = (entry) =>
  entry.transitionCapable ?? entry.layer === "transition";

const preferWork = (entries, workId) => {
  if (!workId) return entries;
  const local = entries.filter(
    (entry) => entry.scope === "work" && entry.workId === workId,
  );
  return local.length ? local : entries;
};

export function loadRegistry(cfg) {
  return readJson(path.join(cfg.paths.data, "edl", "signatures.json"), {
    version: 1,
    signatures: {},
    ranges: {},
    generated: {},
  });
}

function rangesOf(asset) {
  const duration = Number(asset.duration ?? 0);
  if (asset.scenes?.length) {
    return asset.scenes
      .map((scene) => ({ start: scene.start, end: scene.end }))
      .filter((range) => range.end - range.start >= 0.8);
  }
  return duration >= 0.8 ? [{ start: 0, end: duration }] : [];
}

function freeWindow(ranges, used, need, gap, rnd) {
  const ordered = [...used]
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end))
    .sort((a, b) => a.start - b.start);

  for (const range of shuffle(ranges, rnd)) {
    const blocked = ordered.filter(
      (item) => item.end > range.start && item.start < range.end,
    );
    const gaps = [];
    let cursor = range.start;
    for (const item of blocked) {
      if (item.start - cursor >= need) {
        gaps.push([cursor, Math.min(item.start - gap, range.end)]);
      }
      cursor = Math.max(cursor, item.end + gap);
    }
    if (range.end - cursor >= need) gaps.push([cursor, range.end]);

    const valid = gaps.filter(([start, end]) => end - start >= need);
    if (!valid.length) continue;
    const [start, end] = pick(valid, rnd);
    const span = Math.max(0, end - start - need);
    return round3(start + rnd() * span);
  }
  return null;
}

function signatureFor(assetId, start, transform, speed) {
  return shortHash(
    `${assetId}|${start.toFixed(3)}|${transform.focus?.join(",") ?? ""}|${
      transform.zoom ?? ""
    }|${transform.motion ?? ""}|${(transform.motionAmount ?? 0).toFixed(4)}|${speed}|${JSON.stringify(
      transform.grade ?? {},
    )}`,
    12,
  );
}

function focusFor(asset, rnd) {
  if (asset.crop && asset.width && asset.height) {
    return [
      (asset.crop.x + asset.crop.w / 2) / asset.width,
      (asset.crop.y + asset.crop.h / 2) / asset.height,
    ];
  }
  return pick(FOCUSES, rnd);
}

function baseTransform(rnd, asset) {
  const motion = asset?.crop
    ? pick(["push", "pull", "still"], rnd)
    : pick(MOTIONS, rnd);
  return {
    focus: asset ? focusFor(asset, rnd) : pick(FOCUSES, rnd),
    zoom: pick(ZOOMS, rnd),
    motion,
    motionAmount: 0.04 + rnd() * 0.05,
    grade: pick(GRADES, rnd),
  };
}

function buildTransform(asset, start, speed, state, rnd) {
  const assetId = asset.id;
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const transform = baseTransform(rnd, asset);
    const signature = signatureFor(assetId, start, transform, speed);
    if (!state.signatures.has(signature) && !state.registry.signatures?.[signature]) {
      return { transform, signature };
    }
  }
  const transform = baseTransform(rnd, asset);
  transform.motionAmount = 0.04 + ((state.nonce++ % 997) / 997) * 0.09;
  return {
    transform,
    signature: signatureFor(assetId, start, transform, speed),
  };
}

function usedFor(assetId, state, includeGlobal) {
  const local = state.ranges[assetId] ?? [];
  if (!includeGlobal) return local;
  const global = (state.registry.ranges?.[assetId] ?? []).map((item) => ({
    start: item.start,
    end: item.end,
  }));
  return [...local, ...global];
}

function pickFootageShot(state, shotDur, rnd) {
  const config = state.cfg.mix;
  const candidates = shuffle(state.pool, rnd).filter((asset) => {
    if (asset.id === state.lastFootageId) return false;
    if ((state.counts[asset.id] ?? 0) >= Number(config.maxPerAsset ?? 3)) {
      return false;
    }
    return rangesOf(asset).length > 0;
  });

  const attempt = (includeGlobal) => {
    for (const asset of candidates) {
      const ranges = rangesOf(asset);
      for (let tries = 0; tries < 4; tries += 1) {
        const speed = pick(SPEEDS, rnd);
        const need = shotDur * speed + 0.12;
        const start = freeWindow(
          ranges,
          usedFor(asset.id, state, includeGlobal),
          need,
          Number(config.minGap ?? 2),
          rnd,
        );
        if (start == null) break;
        const built = buildTransform(asset, start, speed, state, rnd);
        if (!built) continue;
        return {
          asset,
          start,
          speed,
          transform: built.transform,
          signature: built.signature,
          relaxed: !includeGlobal,
        };
      }
    }
    return null;
  };

  const strict = attempt(true);
  if (strict) return strict;
  const relaxed = attempt(false);
  if (relaxed) return relaxed;

  const ordered = shuffle(state.pool, rnd).filter(
    (asset) => rangesOf(asset).length > 0,
  );
  for (const asset of ordered) {
    const start = freeWindow(
      rangesOf(asset),
      usedFor(asset.id, state, false),
      shotDur + 0.12,
      Number(config.minGap ?? 2),
      rnd,
    );
    if (start == null) continue;
    const built = buildTransform(asset, start, 1, state, rnd);
    return {
      asset,
      start,
      speed: 1,
      transform: built.transform,
      signature: built.signature,
      relaxed: true,
    };
  }

  const fallback =
    ordered.find((asset) => asset.id !== state.lastFootageId) ?? ordered[0];
  if (!fallback) return null;
  const range = rangesOf(fallback)[0];
  const span = Math.max(0.6, range.end - range.start - 1);
  const start = round3(range.start + ((state.nonce++ * 1.37) % span));
  const built = buildTransform(fallback, start, 1, state, rnd);
  return {
    asset: fallback,
    start,
    speed: 1,
    transform: built.transform,
    signature: built.signature,
    relaxed: true,
  };
}

function pickGeneratedShot(state, shotDur, rnd, role) {
  const maxPerCreative = Number(state.cfg.mix.maxPerCreative ?? 2);
  const base = state.catalog.filter(
    (entry) =>
      existsSync(entry.fileMp4) &&
      entry.id !== state.lastGeneratedId &&
      isApproved(entry, state.cfg) &&
      qualityAllowed(entry, state.cfg) &&
      sceneEntry(entry) &&
      roleAllowed(entry, role) &&
      (!entry.creativeId ||
        (state.creativeCounts[entry.creativeId] ?? 0) < maxPerCreative),
  );
  const candidates = base.filter((entry) => perceptualAllowed(entry, state));
  const entries = preferWork(candidates.length ? candidates : base, state.workId);
  if (!entries.length) return null;
  const fresh = entries.filter((entry) => !state.usedGenerated.has(entry.id));
  const pool = fresh.length ? fresh : entries;
  const counts = state.registry.generated ?? {};
  const sorted = shuffle(pool, rnd).sort(
    (a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0),
  );
  const entry = sorted[0];
  state.usedPerceptual.push(entry);
  if (entry.creativeId) {
    const capKey = entry.creativeId;
    state.creativeCounts[capKey] = (state.creativeCounts[capKey] ?? 0) + 1;
  }
  const transform = baseTransform(rnd);
  if (entry.category === "camera") {
    transform.motion = "still";
    transform.zoom = 1;
    transform.motionAmount = 0;
  }
  return {
    entry,
    transform,
    signature: signatureFor(`gen:${entry.id}`, 0, transform, 1),
  };
}

function pickOverlay(state, shotDur, rnd) {
  const base = state.catalog.filter(
    (entry) =>
      entry.publicWebm &&
      existsSync(entry.fileWebm) &&
      entry.duration >= 0.5 &&
      entry.id !== state.lastOverlayId &&
      isApproved(entry, state.cfg) &&
      qualityAllowed(entry, state.cfg) &&
      overlayEntry(entry),
  );
  const allowed = base.filter((entry) => perceptualAllowed(entry, state));
  const entries = preferWork(allowed.length ? allowed : base, state.workId);
  if (!entries.length) return null;
  const fresh = entries.filter((entry) => !state.usedOverlay.has(entry.id));
  const pool = fresh.length ? fresh : entries;
  const entry = pick(pool, rnd);
  state.usedPerceptual.push(entry);
  return entry;
}

function pickTransitionAsset(state, shotDur, role, rnd) {
  const base = state.catalog.filter(
    (entry) =>
      entry.publicWebm &&
      existsSync(entry.fileWebm) &&
      entry.id !== state.lastTransitionId &&
      isApproved(entry, state.cfg) &&
      qualityAllowed(entry, state.cfg) &&
      transitionEntry(entry) &&
      roleAllowed(entry, role) &&
      entry.duration >= 0.2,
  );
  const allowed = base.filter((entry) => perceptualAllowed(entry, state));
  const entries = preferWork(allowed.length ? allowed : base, state.workId);
  if (!entries.length) return null;
  const fresh = entries.filter((entry) => !state.usedTransition.has(entry.id));
  const pool = fresh.length ? fresh : entries;
  const entry = pick(pool, rnd);
  state.usedTransition.add(entry.id);
  state.usedPerceptual.push(entry);
  state.lastTransitionId = entry.id;
  return {
    assetId: entry.id,
    src: entry.publicWebm,
    dur: Math.min(Number(shotDur), Number(entry.duration)),
  };
}

const DEFAULT_BEATS = [
  { role: "hook", ratio: 0.14 },
  { role: "build", ratio: 0.26 },
  { role: "proof", ratio: 0.3 },
  { role: "turn", ratio: 0.18 },
  { role: "close", ratio: 0.12 },
];

function planBeats(cfg, rnd) {
  const configured = cfg.mix.beats?.length ? cfg.mix.beats : DEFAULT_BEATS;
  const total = Number(cfg.mix.duration);
  const jitter = Math.max(0, Number(cfg.mix.beatJitter ?? 0.15));
  const weighted = configured.map((beat) => ({
    role: beat.role,
    ratio: Math.max(
      0.02,
      Number(beat.ratio ?? 0) * (1 + (rnd() * 2 - 1) * jitter),
    ),
  }));
  const sum = weighted.reduce((acc, beat) => acc + beat.ratio, 0) || 1;
  let used = 0;
  return weighted.map((beat, index) => {
    const last = index === weighted.length - 1;
    const duration = last
      ? Math.max(0.5, total - used)
      : Math.max(0.5, (total * beat.ratio) / sum);
    const at = used;
    used += duration;
    return { role: beat.role, at, dur: duration };
  });
}

function beatIndexFor(start, beats) {
  for (let i = beats.length - 1; i >= 0; i -= 1) {
    if (start >= beats[i].at - 1e-6) return i;
  }
  return 0;
}

/**
 * 节拍是叙事段落，镜头是剪辑单位。短片的 5 个节拍不应该强制 5 刀：
 * 先按目标镜头长度定数量，再合并/拆分节拍，并让长短镜头交替。
 */
function planShotSegments(cfg, beats, rnd) {
  const total = beats[beats.length - 1].at + beats[beats.length - 1].dur;
  const options = cfg.mix.shotLength ?? {};
  const minLen = Math.max(0.6, Number(options.min ?? 1.4));
  const maxLen = Math.max(minLen + 0.2, Number(options.max ?? 2.6));
  const minShots = Math.max(2, Number(cfg.mix.minShots ?? 4));
  const maxShots = Math.max(minShots, Number(cfg.mix.maxShots ?? 12));
  const targetLen = minLen + (maxLen - minLen) * (0.3 + rnd() * 0.4);
  const targetShots = Math.max(
    minShots,
    Math.min(maxShots, Math.round(total / targetLen)),
  );

  let segments = beats.map((beat) => ({
    start: beat.at,
    end: beat.at + beat.dur,
    role: beat.role,
    roles: [beat.role],
    turnHint: beat.role === "turn",
  }));

  while (segments.length > targetShots) {
    let best = null;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const a = segments[i];
      const b = segments[i + 1];
      if (a.roles.includes("close") || b.roles.includes("close")) continue;
      if (a.roles.includes("turn") || b.roles.includes("turn")) continue;
      let score = a.end - a.start + (b.end - b.start);
      if (a.roles.includes("hook") || b.roles.includes("hook")) score += 1.5;
      if (a.roles.includes("build") || b.roles.includes("build")) score -= 0.5;
      if (a.roles.includes("proof") || b.roles.includes("proof")) score -= 0.3;
      if (!best || score < best.score) best = { index: i, score };
    }
    if (!best) break;
    const [a, b] = segments.splice(best.index, 2);
    segments.splice(best.index, 0, {
      start: a.start,
      end: b.end,
      role: a.role,
      roles: [...a.roles, ...b.roles],
      turnHint: a.turnHint || b.turnHint,
    });
  }

  let accent = rnd() < 0.5;
  while (segments.length < targetShots) {
    let longest = -1;
    let longestLen = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const len = segments[i].end - segments[i].start;
      if (len >= minLen * 1.5 && len > longestLen) {
        longest = i;
        longestLen = len;
      }
    }
    if (longest < 0) break;
    const segment = segments[longest];
    const len = segment.end - segment.start;
    const ratio = (accent ? 0.62 : 0.38) + (rnd() - 0.5) * 0.06;
    const cut = segment.start + len * ratio;
    if (cut - segment.start < 0.5 || segment.end - cut < 0.5) {
      accent = !accent;
      continue;
    }
    segments.splice(
      longest,
      1,
      { ...segment, end: cut, turnHint: segment.turnHint },
      { ...segment, start: cut, turnHint: false },
    );
    accent = !accent;
  }

  while (true) {
    let index = -1;
    let longestLen = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const len = segments[i].end - segments[i].start;
      if (len > maxLen * 1.8 && len > longestLen) {
        index = i;
        longestLen = len;
      }
    }
    if (index < 0) break;
    const segment = segments[index];
    const ratio = 0.56 + (rnd() - 0.5) * 0.12;
    const cut = segment.start + longestLen * ratio;
    segments.splice(
      index,
      1,
      { ...segment, end: cut, turnHint: segment.turnHint },
      { ...segment, start: cut, turnHint: false },
    );
  }

  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1];
    const cur = segments[i];
    const prevLen = prev.end - prev.start;
    const curLen = cur.end - cur.start;
    const span = prevLen + curLen;
    if (span <= 0 || Math.abs(prevLen - curLen) > span * 0.18) continue;
    const shift = (rnd() < 0.5 ? 1 : -1) * span * (0.08 + rnd() * 0.06);
    const cut = Math.min(
      cur.end - 0.5,
      Math.max(prev.start + 0.5, cur.start + shift),
    );
    prev.end = cut;
    cur.start = cut;
  }

  return { segments, targetShots, targetLen, minLen, maxLen };
}

function finalizeTiming(shots, total, fps) {
  const totalFrames = Math.max(1, Math.round(total * fps));
  let cumulative = 0;
  let previousFrame = 0;
  const out = [];
  shots.forEach((shot, index) => {
    cumulative += shot.dur;
    let frame =
      index === shots.length - 1
        ? totalFrames
        : Math.round((cumulative / total) * totalFrames);
    frame = Math.max(
      previousFrame + 1,
      Math.min(totalFrames - (shots.length - 1 - index), frame),
    );
    out.push({
      ...shot,
      at: previousFrame / fps,
      dur: (frame - previousFrame) / fps,
    });
    previousFrame = frame;
  });
  return { shots: out, totalFrames };
}

const INDEX_CACHE = new Map();

function loadIndex(file, fallback) {
  if (!INDEX_CACHE.has(file)) {
    INDEX_CACHE.set(file, readJson(file, fallback));
  }
  return INDEX_CACHE.get(file);
}

const MOOD_SYNONYMS = {
  calm: ["calm", "chill", "ambient", "lofi"],
  focused: ["focused", "tech", "calm", "chill"],
  cinematic: ["cinematic", "tense", "dark"],
  uplifting: ["uplifting", "bright", "chill"],
  energetic: ["energetic", "high", "uplifting"],
};

function pickAutoTrack(cfg, tracks) {
  const config =
    typeof cfg.mix.music === "object" && cfg.mix.music ? cfg.mix.music : {};
  const mood = config.mood ?? "calm";
  const energy = config.energy ?? "medium";
  const duration = Number(cfg.mix.duration);
  const scored = tracks.map((track) => {
    let score = 0;
    if ((track.duration ?? 0) >= duration + 3) score += 4;
    if (track.license === "CC0 1.0") score += 3;
    if (track.mood === mood) score += 3;
    else if ((MOOD_SYNONYMS[mood] ?? []).includes(track.mood)) score += 2;
    if (track.energy === energy) score += 3;
    else score -= 1;
    if (track.roles?.includes("proof")) score += 1;
    if (cfg.mix.bpm && track.bpm) score -= Math.abs(track.bpm - cfg.mix.bpm) / 20;
    return { track, score };
  });
  scored.sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id));
  return scored[0]?.track ?? null;
}

function musicSrcOf(cfg, file) {
  for (const root of cfg.assetRoots) {
    const dir = path.join(root, "music");
    if (file.startsWith(dir + path.sep)) {
      const relative = path.relative(dir, file).split(path.sep).join("/");
      return `assets/music/${relative}`;
    }
  }
  return linkMusic(cfg, file);
}

function resolveMusic(cfg) {
  const config = cfg.mix.music;
  if (!config) return null;

  const indexFile = path.join(
    cfg.paths.shared,
    "audio",
    "music.index.json",
  );
  const index = loadIndex(indexFile, { tracks: [] });
  const tracks = (index.tracks ?? []).filter((track) =>
    findAssetFile(cfg.assetRoots, `music/${track.file}`),
  );
  const options = typeof config === "object" ? config : {};
  let track = null;
  let file = null;

  if (typeof config === "string") {
    if (config === "auto") {
      track = pickAutoTrack(cfg, tracks);
    } else {
      file = path.isAbsolute(config)
        ? config
        : path.resolve(cfg.paths.repo, config);
    }
  } else if (typeof config === "object") {
    const value = config.file ?? config.path;
    if (config.mode === "auto" || !value) {
      track = pickAutoTrack(cfg, tracks);
    } else {
      const byId = tracks.find((item) => item.id === value);
      if (byId) {
        track = byId;
      } else if (path.isAbsolute(value)) {
        file = value;
      } else {
        const direct = path.resolve(cfg.paths.repo, value);
        file = existsSync(direct)
          ? direct
          : findAssetFile(cfg.assetRoots, `music/${value}`);
      }
    }
  }

  if (track) {
    file =
      findAssetFile(cfg.assetRoots, `music/${track.file}`) ??
      path.resolve(cfg.paths.repo, track.file);
  }
  if (!file || !existsSync(file)) {
    console.warn(`[mix] 背景音乐不存在，已忽略：${file ?? "(auto)"}`);
    return null;
  }
  if (track?.attributionRequired) {
    console.warn(`[mix] 使用 CC BY 曲目，发布时需署名：${track.attribution}`);
  }

  const duration = Number(track?.duration ?? 0);
  const loop = Boolean(
    track?.loop ||
      (duration > 0 && duration < Number(cfg.mix.duration) + 1),
  );
  const src = musicSrcOf(cfg, file);
  return {
    src,
    volume: Number(options.volume ?? track?.volume ?? 0.6),
    fadeIn: Number(options.fadeIn ?? 0.8),
    fadeOut: Number(options.fadeOut ?? 1.0),
    duckTo: Number(options.duckTo ?? 0.22),
    loop,
    bpm: track?.bpm ?? cfg.mix.bpm ?? null,
    title: track?.title,
    artist: track?.artist,
    license: track?.license,
    attribution: track?.attribution,
    attributionRequired: track?.attributionRequired ?? false,
  };
}

function buildSfx(cfg, beats, shots) {
  const config = cfg.mix.sfx ?? {};
  if (config.enabled === false) return [];

  const indexFile = path.join(
    cfg.paths.shared,
    "audio",
    "sfx.index.json",
  );
  const index = loadIndex(indexFile, { items: [] });
  const items = (index.items ?? []).filter((item) =>
    findAssetFile(cfg.assetRoots, `sfx/${item.file}`),
  );
  if (!items.length) return [];

  const byId = new Map(items.map((item) => [item.id, item]));
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }

  const events = [];
  const seen = new Set();
  const add = (id, at, scale = 1, shotIndex = null) => {
    const item =
      byId.get(id) ?? byCategory.get(id)?.[0] ?? byCategory.get("impact")?.[0];
    if (!item) return;
    const time = round3(Math.max(0, at));
    if (time > Number(cfg.mix.duration) + 0.01) return;
    const key = `${item.id}:${time.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push({
      src: `assets/sfx/${item.file}`,
      at: time,
      dur: item.duration,
      volume: round3(
        Math.min(1, item.gain * Number(config.volume ?? 1) * scale),
      ),
      category: item.category,
      assetId: item.id,
      shotIndex,
    });
  };

  for (const beat of beats) {
    if (beat.role === "hook") {
      add("impact", beat.at, 0.7);
      add("sub", beat.at, 0.6);
    }
    if (beat.role === "turn") {
      add("riser", Math.max(0, beat.at - 0.45), 0.8);
      add("impact", beat.at, 0.6);
      add("sub", beat.at, 0.5);
    }
    if (beat.role === "close") {
      add("impact", beat.at, 0.5);
      add("sub", beat.at, 0.35);
    }
  }

  shots.forEach((shot, shotIndex) => {
    const at = shot.at + (shot.transitionAsset?.dur ?? 0);
    if (shot.transitionAsset) add("whoosh", shot.at, 0.8, shotIndex);
    if (shot.overlay?.category === "text") add("tap", at, 0.6, shotIndex);
    else if (shot.overlay?.category === "icon") add("click", at, 0.7, shotIndex);
    else if (shot.overlay?.category === "graphic") add("sparkle", at, 0.6, shotIndex);
    if (shot.kind === "generated" && shot.category === "ui") {
      add("confirm", shot.at + 0.2, 0.8, shotIndex);
    }
  });

  events.sort(
    (a, b) =>
      a.at - b.at || (a.assetId ?? "").localeCompare(b.assetId ?? ""),
  );

  const minGap = Number(config.minGap ?? 0.05);
  const filtered = [];
  for (const event of events) {
    const prev = filtered[filtered.length - 1];
    if (
      prev &&
      event.category === prev.category &&
      event.at - prev.at < minGap
    ) {
      continue;
    }
    filtered.push(event);
  }

  return filtered.slice(0, Number(config.maxPerOutput ?? 16));
}

export function planOutput(cfg, { index, pool, catalog, registry }) {
  const rnd = makeRng(Number(cfg.mix.seed) + index * 7919);
  const beats = planBeats(cfg, rnd);
  const shotPlan = planShotSegments(cfg, beats, rnd);
  const state = {
    cfg,
    pool,
    catalog,
    registry,
    workId: cfg.mix.work ?? null,
    counts: {},
    ranges: {},
    signatures: new Set(),
    usedGenerated: new Set(),
    usedOverlay: new Set(),
    usedTransition: new Set(),
    usedPerceptual: [],
    creativeCounts: {},    lastFootageId: null,
    lastGeneratedId: null,
    lastOverlayId: null,
    lastTransitionId: null,
    nonce: 0,
  };

  const flat = [];
  const shotBeat = [];
  let globalIndex = 0;
  let footageCount = 0;

  shotPlan.segments.forEach((segment) => {
    const shotDur = segment.end - segment.start;
    const role = segment.role;
    const isFirst = globalIndex === 0;
    const isLast = globalIndex === shotPlan.segments.length - 1;
    const beatIndex = beatIndexFor(segment.start, beats);

    let kind;
    if (isFirst || isLast) kind = "footage";
    else if (segment.turnHint) {
      kind = catalog.length ? "generated" : "footage";
    } else if (role === "hook" || role === "proof" || role === "close") {
      kind = "footage";
    } else {
      kind = rnd() < Number(cfg.mix.generatedRatio ?? 0.3) ? "generated" : "footage";
    }

    let shot = null;
    if (kind === "footage") {
      const picked = pickFootageShot(state, shotDur, rnd);
      if (picked) {
        footageCount += 1;
        const { asset, start, speed, transform, signature, relaxed } = picked;
        state.counts[asset.id] = (state.counts[asset.id] ?? 0) + 1;
        state.ranges[asset.id] = [
          ...(state.ranges[asset.id] ?? []),
          { start, end: start + shotDur * speed },
        ];
        state.signatures.add(signature);
        state.lastFootageId = asset.id;

        let overlay = null;
        const overlayBias = Number(cfg.mix.overlayBias ?? 1);
        const overlayChance = Math.min(
          1,
          Math.max(
            0,
            (role === "hook" ? 0.55 : role === "proof" ? 0.4 : 0.3) *
              overlayBias,
          ),
        );
        if (role !== "turn" && rnd() < overlayChance) {
          const entry = pickOverlay(state, shotDur, rnd);
          if (entry) {
            overlay = {
              assetId: entry.id,
              src: entry.publicWebm,
              dur: Math.min(shotDur, entry.duration),
              blend:
                entry.category === "particle" || entry.category === "icon"
                  ? "screen"
                  : undefined,
              category: entry.category,
            };
            state.usedOverlay.add(entry.id);
            state.lastOverlayId = entry.id;
          }
        }

        shot = {
          kind: "footage",
          assetId: asset.id,
          src: asset.publicSrc,
          sourceFps: asset.fps || 30,
          in: start,
          at: 0,
          dur: shotDur,
          speed,
          transform,
          overlay,
          signature,
          relaxed,
        };
      }
    }

    if (!shot) {
      const generated = pickGeneratedShot(state, shotDur, rnd, role);
      if (generated) {
        state.usedGenerated.add(generated.entry.id);
        state.lastGeneratedId = generated.entry.id;
        state.signatures.add(generated.signature);
        const transform = generated.transform;
        shot = {
          kind: "generated",
          assetId: generated.entry.id,
          category: generated.entry.category,
          src: generated.entry.publicMp4,
          at: 0,
          dur: shotDur,
          transform,
          signature: generated.signature,
        };
      }
    }

    if (!shot) {
      throw new Error(
        `第 ${index + 1} 条没有可用素材：素材池 ${pool.length}，生成素材 ${catalog.length}`,
      );
    }
    if (globalIndex > 0) {
      const transitionAsset = pickTransitionAsset(state, shot.dur, role, rnd);
      if (transitionAsset) {
        shot.transitionAsset = transitionAsset;
      }
    }
    flat.push(shot);
    shotBeat.push(beatIndex);
    globalIndex += 1;
  });

  if (!footageCount) {
    throw new Error("规划结果没有实拍镜头，拒绝出片");
  }

  const total = Number(cfg.mix.duration);
  const { shots, totalFrames } = finalizeTiming(flat, total, cfg.spec.fps);

  const finalBeats = beats.map((beat, beatIndex) => ({
    id: `b${String(beatIndex).padStart(2, "0")}`,
    role: beat.role,
    at: beat.at,
    dur: beat.dur,
    shots: shots.filter((_, shotIndex) => shotBeat[shotIndex] === beatIndex),
  }));

  const stills = finalBeats
    .filter((beat) => beat.shots.length)
    .map((beat) =>
      Math.max(
        0,
        Math.min(
          totalFrames - 1,
          Math.round((beat.at + beat.dur / 2) * cfg.spec.fps),
        ),
      ),
    );

  const music = resolveMusic(cfg);
  const sfx = buildSfx(cfg, finalBeats, shots);
  const bpm = music?.bpm ?? cfg.mix.bpm ?? null;
  const beatFrames = bpm ? Math.round((cfg.spec.fps * 60) / bpm) : null;
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const ownWork = new Set();
  for (const shot of shots) {
    for (const id of [
      shot.assetId,
      shot.overlay?.assetId,
      shot.transitionAsset?.assetId,
    ]) {
      if (!id) continue;
      const entry = catalogById.get(id);
      if (entry?.scope === "work" && entry.workId === cfg.mix.work) {
        ownWork.add(id);
      }
    }
  }

  const edl = {
    version: 1,
    id: cfg.mix.outputId ?? `mix-${cfg.mix.seed}-${index + 1}`,
    title: cfg.mix.title ?? "Mix",
    width: cfg.spec.width,
    height: cfg.spec.height,
    fps: cfg.spec.fps,
    durationInFrames: totalFrames,
    stills: [...new Set(stills)],
    beatFrames,
    workProfile: cfg.mix.workProfile ?? null,
    variation: cfg.mix.variation ?? null,
    audio: music || sfx.length ? { music, sfx } : null,
    beats: finalBeats,
    stats: {
      footageShots: shots.filter((shot) => shot.kind === "footage").length,
      generatedShots: shots.filter((shot) => shot.kind === "generated").length,
      overlays: shots.filter((shot) => shot.overlay).length,
      sfx: sfx.length,
      ownWorkAssets: ownWork.size,
      uniqueFootage: new Set(
        shots.filter((shot) => shot.kind === "footage").map((shot) => shot.assetId),
      ).size,
      relaxed: shots.filter((shot) => shot.relaxed).length,
    },
  };

  return { edl, seeds: { base: cfg.mix.seed, index } };
}
