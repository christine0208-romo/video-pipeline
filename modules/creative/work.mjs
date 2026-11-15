import { existsSync } from "node:fs";
import path from "node:path";
import { readJson, slugify } from "../lib/fsx.mjs";
import { makeRng, shuffle } from "../lib/rng.mjs";
import { mergeCatalog, writeCatalog } from "../generate/catalog.mjs";
import { renderAsset } from "../generate/render.mjs";
import { analyzeEntries } from "../quality/analyze.mjs";
import { pickVariation } from "../generate/variation.mjs";
import { compileProject } from "./compile.mjs";
import { projectEngine, validateAll } from "./loader.mjs";

const LAYERS = ["scene", "overlay", "transition"];

export function selectWorkItems(
  projects,
  engines,
  { counts = {}, workSeed = 1, pool = "all" } = {},
) {
  const poolIds =
    pool === "all" || !Array.isArray(pool) || !pool.length
      ? null
      : new Set(pool);
  const rnd = makeRng(workSeed);
  const candidates = { scene: [], overlay: [], transition: [] };

  for (const project of projects) {
    if (poolIds && !poolIds.has(project.id)) continue;
    const engine = projectEngine(project, engines);
    if (!engine) continue;
    const layer = engine.layer;
    if (!candidates[layer]) continue;
    for (const variant of project.variants) {
      if (variant.enabled === false) continue;
      if ((variant.status ?? "draft") === "retired") continue;
      for (const [index, item] of (variant.items ?? []).entries()) {
        candidates[layer].push({ project, engine, variant, index, item });
      }
    }
  }

  const selected = {};
  for (const layer of LAYERS) {
    const want = Math.max(0, Number(counts[layer] ?? 0));
    selected[layer] = want
      ? shuffle(candidates[layer], rnd).slice(0, want)
      : [];
  }
  return selected;
}

export function buildWorkEntries(
  cfg,
  { workId, workSeed, counts = {}, creativePool = "all", profile = null } = {},
) {
  const { engines, projects, errors } = validateAll(cfg);
  if (errors.length) throw new Error(errors.join("\n"));

  const variation = profile ?? pickVariation(workSeed, cfg);
  const selected = selectWorkItems(projects, engines, {
    counts,
    workSeed,
    pool: creativePool,
  });
  const prefix = `${slugify(workId, 32)}-`;
  const entries = [];

  for (const layer of LAYERS) {
    const groups = new Map();
    for (const item of selected[layer]) {
      const key = `${item.project.id}/${item.variant.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          project: item.project,
          engine: item.engine,
          variant: item.variant,
          indexes: new Set(),
        });
      }
      groups.get(key).indexes.add(item.index);
    }
    for (const group of groups.values()) {
      entries.push(
        ...compileProject(cfg, group.project, group.engine, {
          variantId: group.variant.id,
          profile: variation,
          workSeed,
          scope: "work",
          workId,
          idPrefix: prefix,
          itemFilter: ({ index }) => group.indexes.has(index),
          log: console.log,
        }),
      );
    }
  }

  return { entries, profile: variation, selected };
}

export function generateWorkAssets(
  cfg,
  {
    workId,
    workSeed,
    counts = {},
    creativePool = "all",
    profile = null,
    force = false,
    dryRun = false,
  } = {},
) {
  const { entries, profile: variation } = buildWorkEntries(cfg, {
    workId,
    workSeed,
    counts,
    creativePool,
    profile,
  });

  if (dryRun) {
    for (const entry of entries) {
      console.log(
        `[fission] dry-run ${entry.id} (${entry.layer}, ${entry.duration}s${entry.alpha ? ", alpha" : ""})`,
      );
    }
    return { entries, results: [], failed: 0, profile: variation };
  }

  mergeCatalog(cfg, entries, { preserveShared: true });

  const results = [];
  let failed = 0;
  for (const entry of entries) {
    try {
      const count = renderAsset(cfg, entry, {
        force,
        dryRun,
        logPrefix: "[fission]",
      });
      results.push({ entry, count });
      if (count) entry.quality = null;
      const files = [
        existsSync(entry.fileMp4) || count ? "mp4" : null,
        entry.fileWebm && (existsSync(entry.fileWebm) || count)
          ? "webm"
          : null,
      ]
        .filter(Boolean)
        .join("+");
      console.log(
        `[fission] ${entry.id} (${entry.layer}, ${entry.duration}s${
          entry.alpha ? ", alpha" : ""
        }) ${files || "cached"}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[fission] 失败 ${entry.id}：${error.message}`);
    }
  }

  if (!dryRun && cfg.creative?.autoQuality !== false) {
    const changed = new Set(
      results.filter((item) => item.count > 0).map((item) => item.entry.id),
    );
    const catalogFile = path.join(cfg.paths.data, "catalog.json");
    const catalog = readJson(catalogFile, null);
    if (catalog?.assets?.length) {
      for (const asset of catalog.assets) {
        if (changed.has(asset.id)) asset.quality = null;
      }
      const targets = catalog.assets;
      if (targets.length) {
        const quality = analyzeEntries(cfg, targets, {
          logPrefix: "[fission]",
        });
        if (quality.analyzed) writeCatalog(cfg, targets);
      }
    }
  }

  return { entries, results, failed, profile: variation };
}
