import { existsSync } from "node:fs";
import path from "node:path";
import { readJson, shortHash } from "../lib/fsx.mjs";
import { linkMusic } from "../lib/public.mjs";

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
const GRADES = [
  {},
  { saturation: 1.08, contrast: 1.05 },
  { saturation: 0.92, contrast: 1.1 },
  { brightness: 0.92, saturation: 1.04 },
  { brightness: 1.04, contrast: 0.98 },
];
const OVERLAYS = ["none", "none", "grain", "scanline", "vignette"];
const TRANSITIONS = ["cut", "cut", "cut", "flash", "whip", "zoom", "wipe"];

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

function shuffle(list, rnd) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const round3 = (value) => Math.round(value * 1000) / 1000;

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
    )}|${transform.overlay ?? ""}`,
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
    overlay: pick(OVERLAYS, rnd),
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

function pickGeneratedShot(state, shotDur, rnd) {
  const entries = state.catalog.filter(
    (entry) => existsSync(entry.fileMp4) && entry.id !== state.lastGeneratedId,
  );
  if (!entries.length) return null;
  const fresh = entries.filter((entry) => !state.usedGenerated.has(entry.id));
  const pool = fresh.length ? fresh : entries;
  const counts = state.registry.generated ?? {};
  const sorted = shuffle(pool, rnd).sort(
    (a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0),
  );
  const entry = sorted[0];
  const transform = baseTransform(rnd);
  return {
    entry,
    transform,
    signature: signatureFor(`gen:${entry.id}`, 0, transform, 1),
  };
}

function pickOverlay(state, shotDur, rnd) {
  const entries = state.catalog.filter(
    (entry) =>
      entry.publicWebm &&
      existsSync(entry.fileWebm) &&
      entry.duration >= shotDur + 0.1 &&
      entry.id !== state.lastOverlayId,
  );
  if (!entries.length) return null;
  const fresh = entries.filter((entry) => !state.usedOverlay.has(entry.id));
  const pool = fresh.length ? fresh : entries;
  return pick(pool, rnd);
}

function pickTransition(role, index, rnd) {
  if (index === 0) return "cut";
  if (role === "turn") return rnd() < 0.5 ? "whip" : "flash";
  if (role === "hook") return "zoom";
  return pick(TRANSITIONS, rnd);
}

function planBeats(cfg) {
  const configured = cfg.mix.beats?.length
    ? cfg.mix.beats
    : [
        { role: "hook", ratio: 0.14 },
        { role: "build", ratio: 0.26 },
        { role: "proof", ratio: 0.3 },
        { role: "turn", ratio: 0.18 },
        { role: "close", ratio: 0.12 },
      ];
  const total = Number(cfg.mix.duration);
  let used = 0;
  return configured.map((beat, index) => {
    const last = index === configured.length - 1;
    const duration = last
      ? Math.max(0.8, total - used)
      : Math.max(0.8, total * Number(beat.ratio ?? 0));
    const at = used;
    used += duration;
    return { role: beat.role, at, dur: duration };
  });
}

function splitBeat(duration, rnd) {
  const count = Math.max(1, Math.round(duration / (1.8 + rnd() * 0.9)));
  if (count === 1) return [duration];
  const weights = Array.from({ length: count }, () => 0.85 + rnd() * 0.3);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((weight) => (duration * weight) / sum);
  const head = raw.slice(0, -1).reduce((a, b) => a + b, 0);
  raw[raw.length - 1] = duration - head;
  return raw;
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

function resolveMusic(cfg) {
  if (!cfg.mix.music) return null;
  const file = path.isAbsolute(cfg.mix.music)
    ? cfg.mix.music
    : path.resolve(cfg.paths.repo, cfg.mix.music);
  if (!existsSync(file)) {
    console.warn(`[mix] 背景音乐不存在，已忽略：${file}`);
    return null;
  }
  return { src: linkMusic(cfg, file), volume: 0.32 };
}

export function planOutput(cfg, { index, pool, catalog, registry }) {
  const rnd = makeRng(Number(cfg.mix.seed) + index * 7919);
  const beats = planBeats(cfg);
  const state = {
    cfg,
    pool,
    catalog,
    registry,
    counts: {},
    ranges: {},
    signatures: new Set(),
    usedGenerated: new Set(),
    usedOverlay: new Set(),
    lastFootageId: null,
    lastGeneratedId: null,
    lastOverlayId: null,
    nonce: 0,
  };

  const grouped = [];
  let globalIndex = 0;
  let footageCount = 0;

  beats.forEach((beat, beatIndex) => {
    const durations = splitBeat(beat.dur, rnd);
    const shotPlans = [];
    durations.forEach((shotDur, shotIndex) => {
      const isFirst = globalIndex === 0;
      const isLast =
        beatIndex === beats.length - 1 && shotIndex === durations.length - 1;
      const role = beat.role;

      let kind;
      if (isFirst || isLast) kind = "footage";
      else if (role === "hook" || role === "proof" || role === "close") {
        kind = "footage";
      } else if (role === "turn") {
        kind = catalog.length ? "generated" : "footage";
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
          const overlayChance = role === "hook" ? 0.55 : role === "proof" ? 0.4 : 0.3;
          if (role !== "turn" && rnd() < overlayChance) {
            const entry = pickOverlay(state, shotDur, rnd);
            if (entry) {
              overlay = {
                assetId: entry.id,
                src: entry.publicWebm,
                dur: Math.min(shotDur, entry.duration),
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
            transitionIn: pickTransition(role, globalIndex, rnd),
            signature,
            relaxed,
          };
        }
      }

      if (!shot) {
        const generated = pickGeneratedShot(state, shotDur, rnd);
        if (generated) {
          state.usedGenerated.add(generated.entry.id);
          state.lastGeneratedId = generated.entry.id;
          state.signatures.add(generated.signature);
          const transform = generated.transform;
          shot = {
            kind: "generated",
            assetId: generated.entry.id,
            src: generated.entry.publicMp4,
            at: 0,
            dur: shotDur,
            transform,
            transitionIn: pickTransition(role, globalIndex, rnd),
            signature: generated.signature,
          };
        }
      }

      if (!shot) {
        throw new Error(
          `第 ${index + 1} 条没有可用素材：素材池 ${pool.length}，生成素材 ${catalog.length}`,
        );
      }
      shotPlans.push(shot);
      globalIndex += 1;
    });
    grouped.push({ ...beat, shots: shotPlans });
  });

  if (!footageCount) {
    throw new Error("规划结果没有实拍镜头，拒绝出片");
  }

  const flat = grouped.flatMap((beat) => beat.shots);
  const total = Number(cfg.mix.duration);
  const { shots, totalFrames } = finalizeTiming(flat, total, cfg.spec.fps);

  let cursor = 0;
  const finalBeats = grouped.map((beat, beatIndex) => {
    const count = beat.shots.length;
    const slice = shots.slice(cursor, cursor + count);
    cursor += count;
    const at = slice[0].at;
    const last = slice[slice.length - 1];
    return {
      id: `b${String(beatIndex).padStart(2, "0")}`,
      role: beat.role,
      at,
      dur: last.at + last.dur - at,
      shots: slice,
    };
  });

  const stills = finalBeats.map((beat) =>
    Math.max(0, Math.min(totalFrames - 1, Math.round((beat.at + beat.dur / 2) * cfg.spec.fps))),
  );

  const edl = {
    version: 1,
    id: cfg.mix.outputId ?? `mix-${cfg.mix.seed}-${index + 1}`,
    title: cfg.mix.title ?? "Mix",
    width: cfg.spec.width,
    height: cfg.spec.height,
    fps: cfg.spec.fps,
    durationInFrames: totalFrames,
    stills: [...new Set(stills)],
    audio: resolveMusic(cfg),
    beats: finalBeats,
    stats: {
      footageShots: shots.filter((shot) => shot.kind === "footage").length,
      generatedShots: shots.filter((shot) => shot.kind === "generated").length,
      overlays: shots.filter((shot) => shot.overlay).length,
      uniqueFootage: new Set(
        shots.filter((shot) => shot.kind === "footage").map((shot) => shot.assetId),
      ).size,
      relaxed: shots.filter((shot) => shot.relaxed).length,
    },
  };

  return { edl, seeds: { base: cfg.mix.seed, index } };
}
