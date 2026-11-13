import path from "node:path";
import { PIPELINE_ROOT } from "../lib/config.mjs";
import { readJson } from "../lib/fsx.mjs";

export const RECIPE_LAYERS = new Set(["scene", "overlay", "transition", "post"]);
export const RECIPE_ENGINES = new Set([
  "text",
  "shape",
  "particle",
  "camera",
  "transition",
  "data",
  "ui",
  "icon",
]);

const ALL_BEAT_ROLES = ["hook", "build", "proof", "turn", "close"];

const CATEGORY_BY_ENGINE = {
  text: "text",
  transition: "transition",
  particle: "particle",
  camera: "camera",
  ui: "ui",
  icon: "icon",
  shape: "graphic",
  data: "data",
};

export function recipeCategory(recipe) {
  return recipe.category ?? CATEGORY_BY_ENGINE[recipe.engine] ?? recipe.layer;
}

export function readRecipes() {
  const file = path.join(PIPELINE_ROOT, "src", "generated", "recipes.json");
  const data = readJson(file, { recipes: [] });
  const recipes = data.recipes ?? [];
  const ids = new Set();

  for (const recipe of recipes) {
    if (!recipe.id) throw new Error("recipe 缺少 id");
    if (ids.has(recipe.id)) throw new Error(`recipe id 重复：${recipe.id}`);
    ids.add(recipe.id);
    if (!recipe.preset) throw new Error(`recipe ${recipe.id} 缺少 preset`);
    if (!RECIPE_ENGINES.has(recipe.engine)) {
      throw new Error(`recipe ${recipe.id} engine 未知：${recipe.engine}`);
    }
    if (!RECIPE_LAYERS.has(recipe.layer)) {
      throw new Error(`recipe ${recipe.id} layer 未知：${recipe.layer}`);
    }
    if (!(recipe.durationFrames > 0)) {
      throw new Error(`recipe ${recipe.id} durationFrames 必须大于 0`);
    }
    if (
      recipe.code === "T06" &&
      recipe.axes?.text &&
      recipe.axes?.keyword &&
      recipe.axes.text.length !== recipe.axes.keyword.length
    ) {
      throw new Error(`recipe ${recipe.id} 的 text / keyword 轴长度不一致`);
    }
  }

  return recipes.filter((recipe) => !recipe.disabled);
}

export function selectRecipes(recipes, selected) {
  if (!selected?.length) return [];
  if (selected.includes("all")) return recipes;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const out = [];
  for (const id of selected) {
    const recipe = byId.get(id);
    if (!recipe) {
      console.warn(`[generate] recipe 不存在，已跳过：${id}`);
      continue;
    }
    out.push(recipe);
  }
  return out;
}

const pickAxis = (value, index, fallback) => {
  if (Array.isArray(value) && value.length) return value[index % value.length];
  return value ?? fallback;
};

export function recipeProps(recipe, index) {
  const axes = recipe.axes ?? {};
  const props = {
    ...recipe.params,
    palette: pickAxis(axes.palette, index, recipe.palette ?? "aurora"),
    seed: Number(pickAxis(axes.seed, index, index + 1)),
  };
  for (const key of [
    "text",
    "keyword",
    "countFrom",
    "countTo",
    "prefix",
    "suffix",
    "glitchIndex",
    "glitchLabel",
  ]) {
    if (axes[key] !== undefined) {
      props[key] = pickAxis(axes[key], index, recipe.params?.[key]);
    }
  }
  return props;
}

export function recipeBeatRoles(recipe) {
  return recipe.beatRoles?.length ? recipe.beatRoles : ALL_BEAT_ROLES;
}
