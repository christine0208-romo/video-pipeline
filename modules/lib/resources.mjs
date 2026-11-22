import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  diffAssetFiles,
  findAssetFile,
  resolveAudioFile,
  sha256,
} from "./assets.mjs";
import { ensureFontMeta, fontEntries, renderFontsTs } from "./fonts.mjs";

const rel = (cfg, file) =>
  path.relative(cfg.paths.repo, file).split(path.sep).join("/");

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function manifestPath(cfg) {
  return path.join(cfg.paths.shared, "assets.manifest.json");
}

export function requirementsPath(cfg) {
  return path.join(cfg.paths.shared, "requirements.json");
}

export function loadManifest(cfg) {
  const file = manifestPath(cfg);
  const exists = existsSync(file);
  return {
    file,
    exists,
    data: exists ? readJson(file, { version: 1, assets: [] }) : { version: 1, assets: [] },
  };
}

export function loadAudioIndexes(cfg) {
  return {
    music: readJson(path.join(cfg.paths.shared, "audio", "music.index.json"), {
      version: 1,
      tracks: [],
    }).tracks ?? [],
    sfx: readJson(path.join(cfg.paths.shared, "audio", "sfx.index.json"), {
      version: 1,
      items: [],
    }).items ?? [],
  };
}

/** 素材、字体、音频与磁盘差异的统一视图。 */
export function inventory(cfg) {
  const manifest = loadManifest(cfg);
  const entries = manifest.data.assets ?? [];
  const diff = manifest.exists
    ? diffAssetFiles(entries, cfg.assetRoots)
    : { added: [], changed: [], missing: [], shadowed: [], onDisk: new Map() };
  const indexes = loadAudioIndexes(cfg);
  return {
    manifestFile: manifest.file,
    manifestExists: manifest.exists,
    manifest: manifest.data,
    entries,
    diff,
    fonts: fontEntries(manifest.data),
    music: indexes.music.map((track) => ({
      ...track,
      resolved: resolveAudioFile(cfg.assetRoots, "music", track.file),
    })),
    sfx: indexes.sfx.map((item) => ({
      ...item,
      resolved: resolveAudioFile(cfg.assetRoots, "sfx", item.file),
    })),
  };
}

function fontsStale(cfg, manifest) {
  if (!fontEntries(manifest).length) return false;
  const file = path.join(cfg.paths.shared, "fonts.ts");
  if (!existsSync(file)) return true;
  const snapshot = structuredClone(manifest);
  ensureFontMeta(snapshot);
  return readFileSync(file, "utf8") !== renderFontsTs(snapshot);
}

/** 缺失、未登记、哈希、许可未知与元数据缺失。 */
export function checkResources(cfg, { verify = false } = {}) {
  const inv = inventory(cfg);
  const missing = inv.diff.missing.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    url: entry.url ?? null,
  }));
  const unregistered = inv.diff.added.map((item) => ({
    path: item.path,
    size: item.size,
  }));
  const changed = inv.diff.changed.map((item) => ({
    path: item.entry.path,
    sha256: item.sha256,
  }));

  const badHash = [];
  if (verify) {
    for (const entry of inv.entries) {
      const file = findAssetFile(cfg.assetRoots, entry.path);
      if (!file) continue;
      const hash = sha256(readFileSync(file));
      if (entry.sha256 && hash !== entry.sha256) {
        badHash.push({ path: entry.path, expected: entry.sha256, actual: hash });
      }
    }
  }

  const unknownLicense = inv.entries
    .filter((entry) => !entry.license || entry.license === "unknown")
    .map((entry) => ({ path: entry.path, kind: entry.kind }));
  const fontsMissingMeta = inv.fonts
    .filter((entry) => !entry.family || !entry.weight)
    .map((entry) => ({ path: entry.path }));
  const audioMissingMeta = [
    ...inv.music
      .filter(
        (track) =>
          !track.mood ||
          track.mood === "unknown" ||
          !track.energy ||
          track.energy === "unknown",
      )
      .map((track) => ({
        kind: "music",
        id: track.id,
        file: track.file,
        missing: [
          ...(!track.mood || track.mood === "unknown" ? ["mood"] : []),
          ...(!track.energy || track.energy === "unknown" ? ["energy"] : []),
        ],
      })),
    ...inv.sfx
      .filter((item) => !item.category || item.category === "unknown")
      .map((item) => ({
        kind: "sfx",
        id: item.id,
        file: item.file,
        missing: ["category"],
      })),
  ];
  const brokenAudio = [
    ...inv.music
      .filter((track) => !track.resolved)
      .map((track) => ({ kind: "music", id: track.id, file: track.file })),
    ...inv.sfx
      .filter((item) => !item.resolved)
      .map((item) => ({ kind: "sfx", id: item.id, file: item.file })),
  ];
  const stale = fontsStale(cfg, inv.manifest);

  return {
    ok:
      missing.length === 0 &&
      badHash.length === 0 &&
      brokenAudio.length === 0 &&
      !stale,
    manifest: inv.manifestExists,
    entries: inv.entries.length,
    roots: cfg.assetRoots.map((root) => rel(cfg, root)),
    missing,
    unregistered,
    changed,
    badHash,
    licenses: { unknown: unknownLicense },
    meta: { fonts: fontsMissingMeta, audio: audioMissingMeta },
    brokenAudio,
    fontsStale: stale,
  };
}

const normalizeKind = (kind) => String(kind ?? "").replace(/s$/, "");

/**
 * shared/requirements.json 是内容侧声明（可选）：
 * { version, fonts:[{family,weight?}], audio:{sfx:[category],musicMoods:[mood]}, kinds:{icon:10} }
 */
export function requirementsStatus(cfg) {
  const file = requirementsPath(cfg);
  if (!existsSync(file)) {
    return { declared: false, ok: true, file: rel(cfg, file), present: [], missing: [] };
  }
  let requirements;
  try {
    requirements = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return {
      declared: true,
      ok: false,
      file: rel(cfg, file),
      error: error.message,
      present: [],
      missing: [],
    };
  }

  const inv = inventory(cfg);
  const present = [];
  const missing = [];
  const check = (ok, item) => (ok ? present : missing).push(item);

  for (const raw of requirements.fonts ?? []) {
    const item = typeof raw === "string" ? { family: raw } : raw;
    if (!item?.family) continue;
    const weight = item.weight === undefined ? null : String(item.weight);
    const ok = inv.fonts.some(
      (entry) =>
        entry.family === item.family &&
        (weight === null || String(entry.weight) === weight),
    );
    check(ok, {
      type: "font",
      label: `${item.family}${weight ? ` ${weight}` : ""}`,
    });
  }

  for (const category of requirements.audio?.sfx ?? []) {
    check(
      inv.sfx.some((item) => item.category === category),
      { type: "sfx", label: category },
    );
  }

  for (const mood of requirements.audio?.musicMoods ?? []) {
    check(
      inv.music.some((track) => track.mood === mood),
      { type: "music", label: mood },
    );
  }

  for (const [kind, min] of Object.entries(requirements.kinds ?? {})) {
    const count = inv.entries.filter(
      (entry) => normalizeKind(entry.kind) === normalizeKind(kind),
    ).length;
    check(count >= Number(min), {
      type: "kind",
      label: `${kind} ≥ ${min}`,
      count,
    });
  }

  return {
    declared: true,
    ok: missing.length === 0,
    file: rel(cfg, file),
    present,
    missing,
  };
}
