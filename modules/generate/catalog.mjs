import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { PIPELINE_ROOT } from "../lib/config.mjs";
import { readJson, shortHash, writeJson } from "../lib/fsx.mjs";
import {
  readRecipes,
  recipeBeatRoles,
  recipeCategory,
  recipeProps,
  selectRecipes,
} from "./recipes.mjs";

const PALETTES = ["aurora", "ember", "mono", "lime", "ice"];
const CLIP_CYCLE = ["sms", "call", "account", "gate", "platform-icon"];
const ALL_BEAT_ROLES = ["hook", "build", "proof", "turn", "close"];

function rotate(list, offset) {
  if (!list.length) return list;
  const index = offset % list.length;
  return [...list.slice(index), ...list.slice(0, index)];
}

function hashNumber(value) {
  return Number.parseInt(shortHash(value, 8), 16) % 1000000;
}

function variantProps({ preset, index, assets }) {
  if (
    preset === "text-atom" ||
    preset === "transition-atom" ||
    preset === "particle-atom" ||
    preset === "camera-scene"
  ) {
    throw new Error(`preset ${preset} 只能通过 recipes 生成；请在 src/generated/recipes.json 配置。`);
  }
  const palette = PALETTES[index % PALETTES.length];
  const seed = hashNumber(`${preset}:${index}`);

  if (preset === "platform-orbit" || preset === "kinetic-grid") {
    return { icons: rotate(assets.social, index), palette, seed };
  }
  if (preset === "social-constellation" || preset === "network-universe") {
    return { icons: rotate(assets.social, index + 2), palette, seed };
  }
  if (preset === "icon-morph") {
    const icons = rotate(assets.messaging, index);
    const labels = icons.map((icon) => {
      const platform = assets.platforms.find((item) => item.icon === icon);
      return platform?.name ?? "";
    });
    return { icons, labels, palette, seed };
  }
  if (preset === "ui-mock") {
    const platform = assets.platforms[index % assets.platforms.length];
    const clip = CLIP_CYCLE[index % CLIP_CYCLE.length];
    return {
      clip,
      platform: platform.name,
      icon: platform.icon,
      palette,
      seed,
    };
  }
  return { palette, seed };
}

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
  recipeId,
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
}) {
  const id = `${idBase}-v${index + 1}-${shortHash(JSON.stringify(props), 6)}`;
  const durationInFrames = durationFrames;
  const duration = Number((durationInFrames / cfg.spec.fps).toFixed(3));
  const formats = new Set(cfg.generate.formats ?? ["mp4"]);
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

  const entry = {
    id,
    preset,
    description: presetMeta.description,
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
    recipeId: recipeId ?? null,
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
      source.kind === "recipe"
        ? "由本工作区生成；配方与提示词见 src/generated/recipes.json。"
        : "品牌图标来自 Simple Icons（CC0 1.0），品牌标识归各平台所有，仅作类别示意。",
  };

  if (!cfg.flags?.["dry-run"]) {
    writeJson(entry.propsMp4File, {
      preset,
      props,
      alpha: false,
      durationInFrames,
      fps: cfg.spec.fps,
      width: cfg.spec.width,
      height: cfg.spec.height,
    });
    if (entry.propsWebmFile) {
      writeJson(entry.propsWebmFile, {
        preset,
        props,
        alpha: true,
        durationInFrames,
        fps: cfg.spec.fps,
        width: cfg.spec.width,
        height: cfg.spec.height,
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

export function readPresetMeta() {
  const presetFile = path.join(
    PIPELINE_ROOT,
    "src",
    "generated",
    "presets.json",
  );
  return readJson(presetFile, { presets: [] });
}

export function makeRecipeEntry(
  cfg,
  recipe,
  presetMeta,
  {
    index = 0,
    props,
    idBase = recipe.id,
    scope = "shared",
    workId = null,
    workSeed = null,
    status = "draft",
    durationFrames,
    variation = null,
  },
) {
  return makeEntry({
    cfg,
    presetMeta,
    preset: recipe.preset,
    props,
    index,
    idBase,
    source: {
      kind: "recipe",
      recipeId: recipe.id,
      code: recipe.code,
      prompt: recipe.prompt ?? recipe.name,
      version: recipe.version ?? 1,
      ...(workId ? { workId, workSeed } : {}),
    },
    layer: recipe.layer,
    beatRoles: recipeBeatRoles(recipe),
    category: recipeCategory(recipe),
    series: recipe.series ?? recipe.id,
    seriesIndex: recipe.seriesIndex ?? index,
    complete: recipe.complete ?? null,
    status,
    recipeId: recipe.id,
    engine: recipe.engine,
    version: recipe.version ?? 1,
    alpha: recipe.alpha ?? Boolean(presetMeta.supportsAlpha),
    durationFrames: Math.max(
      1,
      Math.round(durationFrames ?? recipe.durationFrames),
    ),
    loop: recipe.loop ?? false,
    tags: {
      recipeId: recipe.id,
      code: recipe.code,
      layer: recipe.layer,
      engine: recipe.engine,
      ...(workId ? { workId } : {}),
    },
    labels: [
      ...(recipe.tags ?? []),
      `code:${recipe.code}`,
      `layer:${recipe.layer}`,
      `engine:${recipe.engine}`,
      ...(workId ? [`work:${workId}`] : []),
    ],
    scope,
    workId,
    workSeed,
    variation,
  });
}

function buildPresetEntries(cfg, byId, assets) {
  const entries = [];
  const variants = Number(cfg.generate.variantsPerPreset ?? 2);
  const durationFrames = Math.max(
    1,
    Math.round(Number(cfg.generate.duration ?? 3) * Number(cfg.spec.fps ?? 30)),
  );

  for (const preset of cfg.generate.presets) {
    const presetMeta = byId.get(preset);
    if (!presetMeta) {
      throw new Error(
        `未知 preset：${preset}。可选：${[...byId.keys()].join(", ")}`,
      );
    }
    for (let index = 0; index < variants; index += 1) {
      const props = variantProps({ preset, index, assets });
      entries.push(
        makeEntry({
          cfg,
          presetMeta,
          preset,
          props,
          index,
          idBase: preset,
          source: { kind: "preset", preset },
          layer: "scene",
          beatRoles: ALL_BEAT_ROLES,
          category: presetMeta.category ?? "scene",
          series: presetMeta.series ?? preset,
          seriesIndex: presetMeta.seriesIndex ?? index,
          complete: presetMeta.complete ?? null,
          status: "approved",
          recipeId: null,
          engine: "preset",
          version: 1,
          alpha: Boolean(presetMeta.supportsAlpha),
          durationFrames,
          loop: Boolean(presetMeta.loop),
          tags: {
            preset,
            palette: props.palette,
            alpha: Boolean(presetMeta.supportsAlpha),
            icons: props.icons ?? [],
          },
          labels: [
            "preset",
            preset,
            `palette:${props.palette}`,
            presetMeta.supportsAlpha ? "alpha" : "opaque",
          ],
        }),
      );
    }
  }

  return entries;
}

function buildRecipeEntries(cfg, byId) {
  const recipes = selectRecipes(readRecipes(), cfg.generate.recipes);
  const entries = [];
  const variants = Number(
    cfg.generate.variantsPerRecipe ?? cfg.generate.variantsPerPreset ?? 1,
  );

  for (const recipe of recipes) {
    const presetMeta = byId.get(recipe.preset);
    if (!presetMeta) {
      throw new Error(
        `recipe ${recipe.id} 的 preset 未知：${recipe.preset}。可选：${[...byId.keys()].join(", ")}`,
      );
    }
    const count = Number(recipe.variants ?? variants);
    for (let index = 0; index < count; index += 1) {
      entries.push(
        makeRecipeEntry(cfg, recipe, presetMeta, {
          index,
          props: recipeProps(recipe, index),
          status: "draft",
        }),
      );
    }
  }

  return entries;
}

export function buildCatalog(cfg) {
  const meta = readPresetMeta();
  const assetFile = path.join(
    PIPELINE_ROOT,
    "src",
    "generated",
    "assets.json",
  );
  const assets = readJson(assetFile, {});
  const byId = new Map(meta.presets.map((item) => [item.id, item]));

  return [...buildPresetEntries(cfg, byId, assets), ...buildRecipeEntries(cfg, byId)];
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
  const selectedPresets = new Set(cfg.generate.presets ?? []);
  const selectedRecipes = new Set(cfg.generate.recipes ?? []);
  const mergedIds = new Set(mergedEntries.map((entry) => entry.id));
  const kept = (existing?.assets ?? []).filter((entry) => {
    if (mergedIds.has(entry.id)) return false;
    if (entryScope(entry) !== "shared") return true;
    if (preserveShared) return true;
    if (entry.recipeId) return !selectedRecipes.has(entry.recipeId);
    return !selectedPresets.has(entry.preset);
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
    throw new Error("生成素材库为空：先运行 node run.mjs generate");
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

function deriveLayer(preset, props = {}) {
  if (props.layer) return props.layer;
  if (preset === "transition-atom") return "transition";
  if (preset === "text-atom" || preset === "particle-atom") return "overlay";
  return "scene";
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
    "recipeId",
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
  const presetMeta = new Map(readPresetMeta().presets.map((item) => [item.id, item]));

  const entries = [];
  const dropped = [];
  const orphans = [];
  const preserved = [];

  for (const item of inventory) {
    const old = oldById.get(item.id) ?? null;
    const propsData = propsFor(cfg, item.id, "mp4") ?? propsFor(cfg, item.id, "webm");
    const preset = old?.preset ?? propsData?.preset ?? null;
    const presetInfo = preset ? presetMeta.get(preset) : null;
    const layer = old?.layer ?? deriveLayer(preset, propsData);
    const durationInFrames =
      old?.durationInFrames ??
      propsData?.durationInFrames ??
      Math.round(Number(cfg.generate.duration ?? 3) * Number(cfg.spec.fps ?? 30));

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
      recipeId: old?.recipeId ?? null,
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
      source: old?.source ?? { kind: "reindexed", id: item.id },
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
  const recipeIds = new Set(readRecipes().map((recipe) => recipe.id));
  const siblingStatus = new Map();
  for (const entry of entries) {
    if (!entry.reindexed) siblingStatus.set(idBase(entry.id), entry.status);
  }
  for (const entry of entries) {
    if (!entry.reindexed && !entry.needsReview) continue;
    const variant = Number(entry.id.match(/-v(\d+)-[0-9a-f]+$/i)?.[1] ?? 1);
    entry.status = recipeIds.has(idBase(entry.id)) && variant >= 2
      ? "draft"
      : siblingStatus.get(idBase(entry.id)) ?? "draft";
  }
  for (const entry of entries) {
    const variant = Number(entry.id.match(/-v(\d+)-[0-9a-f]+$/i)?.[1] ?? 1);
    const base = idBase(entry.id);
    const count = entries.filter((other) => idBase(other.id) === base).length;
    if (recipeIds.has(base) && count === 2 && variant === 2 && entry.status !== "retired") {
      entry.status = "draft";
    }
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
