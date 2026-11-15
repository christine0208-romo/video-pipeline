#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listEnginePackages } from "../modules/creative/registry.mjs";
import { scanProjects } from "../modules/lib/projects.mjs";

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
  const creativeRoot = path.join(ROOT, "creative");
  if (!existsSync(creativeRoot)) return;
  const enginesDir = path.join(creativeRoot, "engines");
  if (existsSync(enginesDir)) {
    for (const entry of readdirSync(enginesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        fail(`creative/engines 下存在旧格式 schema：${entry.name}`);
      }
      if (!entry.isDirectory()) continue;
      if (!existsSync(path.join(enginesDir, entry.name, "engine.json"))) {
        fail(`引擎 ${entry.name} 缺少 engine.json`);
      }
      if (!existsSync(path.join(enginesDir, entry.name, "index.tsx"))) {
        fail(`引擎 ${entry.name} 缺少 index.tsx`);
      }
    }
  }
  if (existsSync(creativeRoot)) {
    for (const entry of readdirSync(creativeRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "engines") continue;
      const metaFile = path.join(creativeRoot, entry.name, "engine", "engine.json");
      if (existsSync(metaFile) && !existsSync(path.join(creativeRoot, entry.name, "engine", "index.tsx"))) {
        fail(`本地引擎 ${entry.name} 缺少 engine/index.tsx`);
      }
    }
  }

  const packages = listEnginePackages({ paths: { creative: creativeRoot } });
  const keys = packages.map((item) => item.key);
  if (new Set(keys).size !== keys.length) fail("creative 引擎注册键重复");

  const registryFile = path.join(creativeRoot, "registry.ts");
  if (!existsSync(registryFile)) {
    fail("缺少 creative/registry.ts；运行 npm run creative:init");
  }
  const registryText = readFileSync(registryFile, "utf8");
  const registryKeys = [...registryText.matchAll(/^\s+"([^"]+)":\s*\{/gm)].map(
    (match) => match[1],
  );
  const expected = [...new Set(keys)].sort();
  const actual = [...new Set(registryKeys)].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(
      `creative/registry.ts 与引擎包不一致：期望 ${expected.join(", ")}，实际 ${actual.join(", ")}`,
    );
  }

  if (!keys.length) return;

  const variationFile = path.join(creativeRoot, "shared", "variation.json");
  if (!existsSync(variationFile)) return;
  const variation = JSON.parse(readFileSync(variationFile, "utf8"));
  for (const id of variation.camera?.bases ?? []) {
    if (!keys.includes(id)) fail(`variation.camera.bases 引用了未知 preset：${id}`);
  }
}

function checkProjectManifests() {
  const { errors } = scanProjects(path.join(ROOT, "projects"));
  if (errors.length) fail(errors[0]);
}

function checkCrossReferences(config) {
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
