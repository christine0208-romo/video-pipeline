import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { readJson, shortHash, writeJson } from "../lib/fsx.mjs";

const ALL_BEAT_ROLES = ["hook", "build", "proof", "turn", "close"];

export function stillFrames(entry) {
  return [
    Math.max(0, Math.round(entry.durationInFrames * 0.3)),
    Math.max(0, Math.round(entry.durationInFrames * 0.75)),
  ];
}

export function makeEntry({
  cfg,
  presetMeta,
  preset,
  props,
  index,
  idBase,
  source,
  layer,
  beatRoles,
  status,
  engine,
  version,
  alpha,
  durationFrames,
  loop,
  tags,
  labels,
  category = null,
  series = null,
  seriesIndex = null,
  complete = null,
  scope = "shared",
  workId = null,
  workSeed = null,
  variation = null,
  description = null,
  creativeId = null,
  variantId = null,
  creativeVersion = null,
  variantVersion = null,
  creativeStyle = null,
  paramsHash = null,
  idHash = null,
}) {
  const id = `${idBase}-v${index + 1}-${idHash ?? shortHash(JSON.stringify(props), 6)}`;
  const durationInFrames = durationFrames;
  const duration = Number((durationInFrames / cfg.spec.fps).toFixed(3));
  const formats = new Set(
    cfg.creative?.formats ?? ["mp4", "webm-alpha"],
  );
  const useAlpha = Boolean(
    alpha && presetMeta.supportsAlpha && formats.has("webm-alpha"),
  );
  const propsMp4File = path.join(cfg.paths.data, "props", `${id}.mp4.json`);
  const propsWebmFile = useAlpha
    ? path.join(cfg.paths.data, "props", `${id}.webm.json`)
    : null;
  const sceneCapable = layer === "scene";
  const overlayCapable = useAlpha && layer !== "transition";
  const transitionCapable = layer === "transition";
  const creativeMeta = creativeId
    ? {
        creativeId,
        variantId,
        creativeVersion,
        variantVersion,
        style: creativeStyle,
        paramsHash,
      }
    : null;

  const entry = {
    id,
    preset,
    description: description ?? presetMeta.description,
    props,
    alpha: useAlpha,
    layer,
    category: category ?? (layer === "transition" ? "transition" : layer),
    series,
    seriesIndex,
    complete,
    sceneCapable,
    overlayCapable,
    transitionCapable,
    beatRoles,
    status,
    creativeId,
    variantId,
    creativeVersion,
    variantVersion,
    style: creativeStyle,
    paramsHash,
    engine,
    version,
    loop: Boolean(loop),
    width: cfg.spec.width,
    height: cfg.spec.height,
    fps: cfg.spec.fps,
    duration,
    durationInFrames,
    publicMp4: `generated/${id}.mp4`,
    fileMp4: path.join(cfg.paths.out, "assets", `${id}.mp4`),
    publicWebm: useAlpha ? `generated/${id}.webm` : null,
    fileWebm: useAlpha
      ? path.join(cfg.paths.out, "assets", `${id}.webm`)
      : null,
    propsMp4File,
    propsWebmFile,
    stills: stillFrames({ durationInFrames }).map((frame) =>
      path.join(cfg.paths.out, "stills", "assets", `${id}-${frame}.png`),
    ),
    tags,
    labels,
    source,
    scope,
    workId,
    workSeed,
    variation,
    sharedAt: null,
    quality: { alphaCoverage: null, motionEnergy: null, phash: null },
    usage: { count: 0, lastUsed: null },
    license:
      source.kind === "creative"
        ? `由创意工程编译生成；定义见 ${source.file ?? `creative/${creativeId}/`}。`
        : "品牌图标来自 Simple Icons（CC0 1.0），品牌标识归各平台所有，仅作类别示意。",
  };

  if (!cfg.flags?.["dry-run"]) {
    const common = {
      preset,
      props,
      durationInFrames,
      fps: cfg.spec.fps,
      width: cfg.spec.width,
      height: cfg.spec.height,
    };
    writeJson(entry.propsMp4File, {
      ...common,
      alpha: false,
      ...(creativeMeta ? { creative: creativeMeta } : {}),
    });
    if (entry.propsWebmFile) {
      writeJson(entry.propsWebmFile, {
        ...common,
        alpha: true,
        ...(creativeMeta ? { creative: creativeMeta } : {}),
      });
    }
  }

  return entry;
}

export function entryScope(entry) {
  return entry.scope ?? "shared";
}

export function isVisibleToWork(entry, workId) {
  return entryScope(entry) === "shared" || Boolean(workId && entry.workId === workId);
}

export function readEngineMeta(cfg) {
  const dir = path.join(cfg.paths.creative, "engines");
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, "engine.json");
    if (!existsSync(file)) continue;
    const meta = readJson(file, null);
    if (!meta?.preset) continue;
    map.set(meta.preset, { ...meta, description: meta.label });
  }
  return map;
}

export function mergeCatalog(cfg, entries, { preserveShared = false } = {}) {
  const catalogFile = path.join(cfg.paths.data, "catalog.json");
  const existing = readJson(catalogFile, null);
  const existingById = new Map(
    (existing?.assets ?? []).map((entry) => [entry.id, entry]),
  );
  const mergedEntries = entries.map((entry) => {
    const old = existingById.get(entry.id);
    if (!old) return entry;
    return {
      ...entry,
      scope: old.scope ?? entry.scope,
      workId: old.workId ?? entry.workId,
      workSeed: old.workSeed ?? entry.workSeed,
      sharedAt: old.sharedAt ?? entry.sharedAt,
      status: old.status ?? entry.status,
      approvedAt: old.approvedAt,
      rejectedAt: old.rejectedAt,
      firstSeen: old.firstSeen,
      usage: old.usage ?? entry.usage,
      quality: old.quality ?? entry.quality,
    };
  });
  const mergedIds = new Set(mergedEntries.map((entry) => entry.id));
  const kept = (existing?.assets ?? []).filter((entry) => {
    if (mergedIds.has(entry.id)) return false;
    if (preserveShared) return true;
    return entryScope(entry) !== "shared";
  });
  const catalog = [...kept, ...mergedEntries];
  writeCatalog(cfg, catalog);
  return { catalog, mergedEntries, catalogFile };
}

export function writeCatalog(cfg, entries) {
  const file = path.join(cfg.paths.data, "catalog.json");
  writeJson(file, {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets: entries,
  });
  return file;
}

export function readCatalog(cfg) {
  const file = path.join(cfg.paths.data, "catalog.json");
  const data = readJson(file, null);
  if (!data?.assets?.length) {
    throw new Error("生成素材库为空：先运行 node run.mjs creative build");
  }
  return data.assets;
}

export function inventoryGeneratedFiles(cfg) {
  const dir = path.join(cfg.paths.out, "assets");
  if (!existsSync(dir)) return [];
  const byId = new Map();
  for (const name of readdirSync(dir)) {
    const ext = path.extname(name).toLowerCase();
    if (ext !== ".mp4" && ext !== ".webm") continue;
    const id = path.basename(name, ext);
    const item = byId.get(id) ?? { id };
    if (ext === ".mp4") item.mp4 = path.join(dir, name);
    else item.webm = path.join(dir, name);
    byId.set(id, item);
  }
  return [...byId.values()]
    .filter((item) => item.mp4)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function propsFor(cfg, id, ext) {
  const file = path.join(cfg.paths.data, "props", `${id}.${ext}.json`);
  return existsSync(file) ? readJson(file, null) : null;
}

function deriveLayer(presetInfo, props = {}) {
  return props.layer ?? presetInfo?.layer ?? "scene";
}

function preservedFields(oldEntry) {
  if (!oldEntry) return {};
  const keys = [
    "status",
    "approvedAt",
    "rejectedAt",
    "quality",
    "usage",
    "scope",
    "workId",
    "workSeed",
    "sharedAt",
    "variation",
    "tags",
    "labels",
    "series",
    "seriesIndex",
    "creativeId",
    "variantId",
    "creativeVersion",
    "style",
    "paramsHash",
    "supersededBy",
    "retiredReason",
    "engine",
    "beatRoles",
    "category",
    "layer",
    "complete",
    "loop",
    "description",
    "license",
    "source",
  ];
  const out = {};
  for (const key of keys) if (oldEntry[key] !== undefined) out[key] = oldEntry[key];
  return out;
}

export function reindexCatalog(cfg, { apply = false } = {}) {
  const catalogFile = path.join(cfg.paths.data, "catalog.json");
  const oldCatalog = readJson(catalogFile, { version: 1, assets: [] });
  const oldById = new Map((oldCatalog.assets ?? []).map((entry) => [entry.id, entry]));
  const inventory = inventoryGeneratedFiles(cfg);
  const presetMeta = readEngineMeta(cfg);

  const entries = [];
  const dropped = [];
  const orphans = [];
  const preserved = [];

  for (const item of inventory) {
    const old = oldById.get(item.id) ?? null;
    const propsData = propsFor(cfg, item.id, "mp4") ?? propsFor(cfg, item.id, "webm");
    const preset = old?.preset ?? propsData?.preset ?? null;
    const presetInfo = preset ? presetMeta.get(preset) : null;
    const layer = old?.layer ?? deriveLayer(presetInfo, propsData);
    const durationInFrames =
      old?.durationInFrames ??
      propsData?.durationInFrames ??
      Math.round(3 * Number(cfg.spec.fps ?? 30));

    const entry = {
      id: item.id,
      preset,
      description: old?.description ?? presetInfo?.description ?? null,
      props: old?.props ?? propsData?.props ?? {},
      alpha: Boolean(item.webm) || Boolean(old?.alpha && item.webm),
      layer,
      category: old?.category ?? presetInfo?.category ?? layer,
      series: old?.series ?? preset ?? null,
      seriesIndex: old?.seriesIndex ?? null,
      complete: old?.complete ?? presetInfo?.complete ?? null,
      sceneCapable: layer === "scene",
      overlayCapable: Boolean(item.webm) && layer !== "transition",
      transitionCapable: layer === "transition",
      beatRoles: old?.beatRoles ?? ALL_BEAT_ROLES,
      status: old?.status ?? "draft",
      creativeId: old?.creativeId ?? propsData?.creative?.creativeId ?? null,
      variantId: old?.variantId ?? propsData?.creative?.variantId ?? null,
      creativeVersion:
        old?.creativeVersion ?? propsData?.creative?.creativeVersion ?? null,
      style: old?.style ?? propsData?.creative?.style ?? null,
      paramsHash: old?.paramsHash ?? propsData?.creative?.paramsHash ?? null,
      engine: old?.engine ?? (presetInfo ? "preset" : null),
      version: old?.version ?? 1,
      loop: Boolean(old?.loop ?? presetInfo?.loop),
      width: old?.width ?? propsData?.width ?? cfg.spec.width,
      height: old?.height ?? propsData?.height ?? cfg.spec.height,
      fps: old?.fps ?? propsData?.fps ?? cfg.spec.fps,
      duration: Number((durationInFrames / Number(cfg.spec.fps ?? 30)).toFixed(3)),
      durationInFrames,
      publicMp4: `generated/${item.id}.mp4`,
      fileMp4: item.mp4,
      publicWebm: item.webm ? `generated/${item.id}.webm` : null,
      fileWebm: item.webm ?? null,
      propsMp4File: path.join(cfg.paths.data, "props", `${item.id}.mp4.json`),
      propsWebmFile: item.webm
        ? path.join(cfg.paths.data, "props", `${item.id}.webm.json`)
        : null,
      stills: (old?.stills ?? []).filter((file) => existsSync(file)),
      tags: old?.tags ?? {},
      labels: old?.labels ?? [],
      source:
        old?.source ??
        (propsData?.creative
          ? {
              kind: "creative",
              creativeId: propsData.creative.creativeId,
              variantId: propsData.creative.variantId,
              creativeVersion: propsData.creative.creativeVersion,
              style: propsData.creative.style,
              paramsHash: propsData.creative.paramsHash,
            }
          : { kind: "reindexed", id: item.id }),
      scope: old?.scope ?? "shared",
      workId: old?.workId ?? null,
      workSeed: old?.workSeed ?? null,
      variation: old?.variation ?? null,
      sharedAt: old?.sharedAt ?? null,
      quality: old?.quality ?? { alphaCoverage: null, motionEnergy: null, phash: null },
      usage: old?.usage ?? { count: 0, lastUsed: null },
      license: old?.license ?? "由本工作区生成。",
      ...preservedFields(old),
      layer,
      status: old?.status ?? "draft",
    };
    entries.push(entry);
    if (old) preserved.push(item.id);
    else {
      orphans.push(item.id);
      entry.reindexed = true;
      entry.needsReview = true;
    }
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  const idBase = (id) => id.replace(/-v\d+-[0-9a-f]+$/i, "");
  const siblingStatus = new Map();
  for (const entry of entries) {
    if (!entry.reindexed) siblingStatus.set(idBase(entry.id), entry.status);
  }
  for (const entry of entries) {
    if (!entry.reindexed && !entry.needsReview) continue;
    entry.status = siblingStatus.get(idBase(entry.id)) ?? "draft";
  }
  for (const old of oldCatalog.assets ?? []) {
    if (!entryIds.has(old.id)) {
      dropped.push({
        id: old.id,
        reason: existsSync(old.fileMp4 ?? "") ? "unmatched" : "missing-mp4",
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    inventory: inventory.length,
    kept: entries.length,
    preserved: preserved.length,
    orphans,
    dropped,
  };

  if (apply) writeCatalog(cfg, entries);
  return report;
}
