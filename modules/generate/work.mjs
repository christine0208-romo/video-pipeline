import { existsSync } from "node:fs";
import path from "node:path";
import { readJson, slugify } from "../lib/fsx.mjs";
import { makeRng, seedFrom, shuffle } from "../lib/rng.mjs";
import { readRecipes, recipeProps } from "./recipes.mjs";
import {
  makeRecipeEntry,
  mergeCatalog,
  readPresetMeta,
  writeCatalog,
} from "./catalog.mjs";
import { renderAsset } from "./render.mjs";
import { analyzeEntries } from "../quality/analyze.mjs";
import {
  applyVariation,
  pickVariation,
  variationDuration,
} from "./variation.mjs";

const LAYERS = ["scene", "overlay", "transition"];

export function deriveWorkSeed(workId) {
  return seedFrom(workId);
}

export function selectWorkRecipes(recipes, workSeed, counts = {}) {
  const rnd = makeRng(workSeed);
  const selected = [];

  for (const layer of LAYERS) {
    const want = Math.max(0, Number(counts[layer] ?? 0));
    if (!want) continue;
    const pool = recipes.filter((recipe) => recipe.layer === layer);
    const shuffled = shuffle(pool, rnd);
    const ordered =
      layer === "scene"
        ? [...shuffled].sort(
            (a, b) =>
              Number(b.beatRoles?.includes("turn")) -
              Number(a.beatRoles?.includes("turn")),
          )
        : shuffled;
    for (const recipe of ordered.slice(0, want)) {
      if (!selected.some((item) => item.id === recipe.id)) {
        selected.push(recipe);
      }
    }
  }

  return selected;
}

function axisLength(recipe) {
  const lengths = Object.values(recipe.axes ?? {})
    .filter(Array.isArray)
    .map((axis) => axis.length);
  return Math.max(1, ...lengths);
}

export function jitterRecipeProps(recipe, workSeed, index, profile) {
  const axisIndex =
    Math.abs(seedFrom(`${recipe.id}:${workSeed}`)) % axisLength(recipe);
  const props = recipeProps(recipe, axisIndex);

  if (profile) {
    return applyVariation(recipe, props, profile, workSeed, index);
  }

  const jitter = makeRng(workSeed + index * 101 + seedFrom(recipe.id));
  props.seed = Math.floor(jitter() * 1000000) + workSeed;

  if (["T01", "T03", "T06", "T08"].includes(recipe.code)) {
    props.staggerFrames = Number(
      ((props.staggerFrames ?? 1.5) + jitter() * 1.2).toFixed(2),
    );
    props.distanceEm = Number(
      ((props.distanceEm ?? 0.6) + jitter() * 0.25).toFixed(2),
    );
  }
  if (recipe.code === "P01") {
    props.count = Math.round((props.count ?? 80) * (0.8 + jitter() * 0.4));
  }
  if (recipe.code === "P04") {
    props.count = Math.max(
      3,
      Math.round((props.count ?? 4) + Math.floor(jitter() * 2)),
    );
  }
  if (recipe.code === "P05") {
    props.lines = Math.round((props.lines ?? 90) * (0.8 + jitter() * 0.4));
  }
  if (recipe.engine === "camera") {
    props.amount = Number(
      ((props.amount ?? 0.06) + (jitter() - 0.5) * 0.04).toFixed(3),
    );
  }

  return props;
}

export function buildWorkEntries(
  cfg,
  { workId, workSeed, counts = {}, recipePool = "all", profile },
) {
  const variation = profile ?? pickVariation(workSeed);
  const allRecipes = readRecipes();
  const recipes =
    recipePool === "all" || !recipePool?.length
      ? allRecipes
      : allRecipes.filter((recipe) => recipePool.includes(recipe.id));
  const selected = selectWorkRecipes(recipes, workSeed, counts);
  const byId = new Map(
    readPresetMeta().presets.map((item) => [item.id, item]),
  );
  const idBase = slugify(workId, 32);

  return selected.map((recipe, index) => {
    const presetMeta = byId.get(recipe.preset);
    if (!presetMeta) {
      throw new Error(
        `recipe ${recipe.id} 的 preset 未知：${recipe.preset}`,
      );
    }
    return makeRecipeEntry(cfg, recipe, presetMeta, {
      index: 0,
      props: jitterRecipeProps(recipe, workSeed, index, variation),
      idBase: `${idBase}-${recipe.id}`,
      scope: "work",
      workId,
      workSeed,
      status: "approved",
      durationFrames: variationDuration(recipe, variation, workSeed),
      variation: variation.summary,
    });
  });
}

export function generateWorkAssets(
  cfg,
  {
    workId,
    workSeed,
    counts = {},
    recipePool = "all",
    profile,
    force = false,
    dryRun = false,
  } = {},
) {
  const variation = profile ?? pickVariation(workSeed);
  const entries = buildWorkEntries(cfg, {
    workId,
    workSeed,
    counts,
    recipePool,
    profile: variation,
  });
  if (!dryRun) mergeCatalog(cfg, entries, { preserveShared: true });

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
      if (!dryRun) {
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
      }
    } catch (error) {
      failed += 1;
      console.error(`[fission] 失败 ${entry.id}：${error.message}`);
    }
  }

  if (!dryRun && cfg.quality?.autoAnalyze !== false) {
    const changed = new Set(
      results.filter((item) => item.count > 0).map((item) => item.entry.id),
    );
    const catalogFile = path.join(cfg.paths.data, "catalog.json");
    const catalog = readJson(catalogFile, null);
    if (catalog?.assets?.length) {
      const targets = catalog.assets;
      for (const asset of targets) {
        if (changed.has(asset.id)) asset.quality = null;
      }
      if (targets.length) {
        const quality = analyzeEntries(cfg, targets, {
          logPrefix: "[fission]",
        });
        if (quality.analyzed) writeCatalog(cfg, catalog.assets);
      }
    }
  }

  return { entries, results, failed, profile: variation };
}
