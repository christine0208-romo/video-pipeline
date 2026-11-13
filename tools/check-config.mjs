#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(ROOT, "config", "pipeline.json");
const SCHEMA = path.join(ROOT, "config", "pipeline.schema.json");

const fail = (message) => {
  throw new Error(`[config] ${message}`);
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const typeName = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

function checkNode(value, schema, location) {
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeName(value);
    const integerOk = allowed.includes("integer") && typeof value === "number" && Number.isInteger(value);
    if (!allowed.includes(actual) && !integerOk) fail(`${location} 应为 ${allowed.join("/")}，实际为 ${actual}`);
  }
  if (schema.required) {
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${location}.${key} 缺失`);
    }
  }
  if (schema.additionalProperties === false && isObject(value)) {
    for (const key of Object.keys(value)) {
      if (!schema.properties?.[key]) fail(`${location}.${key} 未在 schema 登记`);
    }
  }
  if (schema.properties && isObject(value)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) checkNode(value[key], child, `${location}.${key}`);
    }
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => checkNode(item, schema.items, `${location}[${index}]`));
  }
  if (schema.enum && !schema.enum.includes(value)) fail(`${location} 值不在允许列表中`);
  if (schema.minimum != null && typeof value === "number" && value < schema.minimum) fail(`${location} 小于最小值 ${schema.minimum}`);
  if (schema.exclusiveMinimum != null && typeof value === "number" && value <= schema.exclusiveMinimum) fail(`${location} 必须大于 ${schema.exclusiveMinimum}`);
  if (schema.maximum != null && value > schema.maximum) fail(`${location} 大于最大值 ${schema.maximum}`);
  if (schema.minLength != null && value.length < schema.minLength) fail(`${location} 不能为空`);
  if (schema.minItems != null && value.length < schema.minItems) fail(`${location} 至少需要 ${schema.minItems} 项`);
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) fail(`${location} 格式不正确`);
}

function checkGeneratedManifest() {
  const presetsFile = path.join(ROOT, "src", "generated", "presets.json");
  const registryFile = path.join(ROOT, "src", "generated", "registry.ts");
  const variationFile = path.join(ROOT, "src", "generated", "variation.json");
  const presets = JSON.parse(readFileSync(presetsFile, "utf8")).presets ?? [];
  const presetIds = presets.map((item) => item.id);
  if (new Set(presetIds).size !== presetIds.length) fail("presets.json 存在重复 id");
  const registryText = readFileSync(registryFile, "utf8");
  const registryIds = [...registryText.matchAll(/^\s+"([^\"]+)":\s+\w+,/gm)].map((match) => match[1]);
  if (new Set(registryIds).size !== registryIds.length) fail("registry.ts 存在重复 id");
  for (const id of presetIds) {
    const file = existsSync(path.join(ROOT, "src", "generated", "presets", `${id}.tsx`))
      ? path.join(ROOT, "src", "generated", "presets", `${id}.tsx`)
      : path.join(ROOT, "src", "generated", "atoms", `${id}.tsx`);
    if (!existsSync(file)) fail(`preset ${id} 缺少实现文件`);
    if (!registryIds.includes(id)) fail(`preset ${id} 未在 registry.ts 注册`);
  }
  for (const id of registryIds) if (!presetIds.includes(id)) fail(`registry.ts 存在未登记 preset：${id}`);
  const variation = JSON.parse(readFileSync(variationFile, "utf8"));
  for (const id of variation.camera?.bases ?? []) if (!presetIds.includes(id)) fail(`variation.camera.bases 引用了未知 preset：${id}`);
}

function checkProjectManifests() {
  const components = JSON.parse(readFileSync(path.join(ROOT, "config", "components.json"), "utf8"));
  for (const project of components.projects ?? []) {
    const projectDir = path.join(ROOT, project.path);
    const manifestFile = path.join(ROOT, project.manifest);
    if (!existsSync(projectDir)) {
      if (project.optional) continue;
      fail(`项目目录不存在：${project.path}`);
    }
    if (!existsSync(manifestFile)) fail(`项目 ${project.id} 缺少 manifest：${project.manifest}`);
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    if (manifest.id !== project.id) fail(`项目 manifest id 不一致：${project.id}`);
  }
}

function checkCrossReferences(config) {
  const presetsFile = path.join(ROOT, "src", "generated", "presets.json");
  const recipesFile = path.join(ROOT, "src", "generated", "recipes.json");
  const presets = JSON.parse(readFileSync(presetsFile, "utf8")).presets ?? [];
  const recipes = JSON.parse(readFileSync(recipesFile, "utf8")).recipes ?? [];
  const presetIds = new Set(presets.map((item) => item.id));
  const recipeIds = new Set(recipes.map((item) => item.id));
  for (const id of config.generate.presets) if (!presetIds.has(id)) fail(`generate.presets 引用了未知 preset：${id}`);
  for (const id of config.generate.recipes) {
    if (!recipeIds.has(id)) fail(`generate.recipes 引用了未知 recipe：${id}`);
    const recipe = recipes.find((item) => item.id === id);
    if (recipe?.disabled) fail(`generate.recipes 不能启用 disabled recipe：${id}`);
  }
  for (const recipe of recipes) {
    if (!presetIds.has(recipe.preset)) fail(`recipe ${recipe.id} 引用了未知 preset：${recipe.preset}`);
  }
  const beatRoles = new Set(["hook", "build", "proof", "turn", "close"]);
  const beatTotal = config.mix.beats.reduce((sum, beat) => {
    if (!beatRoles.has(beat.role)) fail(`mix.beats 有未知 role：${beat.role}`);
    if (typeof beat.ratio !== "number" || beat.ratio <= 0) fail(`mix.beats.${beat.role} ratio 必须大于 0`);
    return sum + beat.ratio;
  }, 0);
  if (Math.abs(beatTotal - 1) > 0.001) fail(`mix.beats ratio 总和应为 1，实际为 ${beatTotal}`);
  if (config.mix.shotLength.min > config.mix.shotLength.max) fail("mix.shotLength.min 不能大于 max");
  if (config.mix.minShots > config.mix.maxShots) fail("mix.minShots 不能大于 maxShots");
}

try {
  if (!existsSync(CONFIG)) fail(`缺少 ${path.relative(ROOT, CONFIG)}`);
  if (!existsSync(SCHEMA)) fail(`缺少 ${path.relative(ROOT, SCHEMA)}`);
  const config = JSON.parse(readFileSync(CONFIG, "utf8"));
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  checkNode(config, schema, "config");
  checkGeneratedManifest();
  checkProjectManifests();
  checkCrossReferences(config);
  console.log("配置检查通过：schema、范围、beat、preset/recipe 引用均有效。");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
