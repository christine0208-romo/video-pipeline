import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { readJson } from "../lib/fsx.mjs";
import { checkFieldDefinition, resolveParams, styleOf } from "./params.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BEAT_ROLES = new Set(["hook", "build", "proof", "turn", "close"]);
const LAYERS = new Set(["scene", "overlay", "transition", "post"]);
const STATUSES = new Set(["active", "paused"]);
const ASSET_STATUSES = new Set(["draft", "approved", "retired"]);

const isObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value);

const rel = (root, file) => path.relative(root, file).split(path.sep).join("/");

function listJsonDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort();
}

function checkBeatRoles(value, location, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((role) => !BEAT_ROLES.has(role))) {
    errors.push(`${location} 含未知节拍角色`);
  }
}

function checkStyle(engine, styleId, style, location, errors) {
  if (!isObject(style)) {
    errors.push(`${location} 必须是对象`);
    return;
  }
  if (!style.label) errors.push(`${location}.label 缺失`);
  if (typeof style.code !== "string" || !style.code) {
    errors.push(`${location}.code 缺失`);
  }
  if (!(Number(style.durationFrames) > 0)) {
    errors.push(`${location}.durationFrames 必须大于 0`);
  }
  checkBeatRoles(style.beatRoles, `${location}.beatRoles`, errors);
  if (style.params !== undefined && !isObject(style.params)) {
    errors.push(`${location}.params 必须是对象`);
  }
  if (style.defaults !== undefined) {
    if (!isObject(style.defaults)) {
      errors.push(`${location}.defaults 必须是对象`);
    } else {
      for (const [key, value] of Object.entries(style.defaults)) {
        if (value !== null && typeof value === "object") {
          errors.push(`${location}.defaults.${key} 只能是基本类型`);
        }
      }
    }
  }
  for (const [key, field] of Object.entries(style.params ?? {})) {
    checkFieldDefinition(key, field, `${location}.params`, errors);
  }
}

function validateEngineData(data, location, errors, codes, engines) {
  if (!isObject(data)) {
    errors.push(`${location} 不是合法 JSON 对象`);
    return null;
  }
  if (!SLUG.test(String(data.id ?? ""))) {
    errors.push(`${location}.id 必须是 kebab-case`);
  }
  if (engines.has(data.id)) errors.push(`${location}.id 重复：${data.id}`);
  if (!data.label) errors.push(`${location}.label 缺失`);
  if (!data.preset) errors.push(`${location}.preset 缺失`);
  if (!LAYERS.has(data.layer)) {
    errors.push(`${location}.layer 未知：${data.layer}`);
  }
  if (typeof data.alpha !== "boolean") {
    errors.push(`${location}.alpha 必须是布尔值`);
  }

  const styles = data.styles;
  if (!isObject(styles) || !Object.keys(styles).length) {
    errors.push(`${location}.styles 至少需要一个风格`);
    return null;
  }
  for (const [styleId, style] of Object.entries(styles)) {
    if (!SLUG.test(styleId)) {
      errors.push(`${location}.styles.${styleId} 必须是 kebab-case`);
    }
    checkStyle(data, styleId, style, `${location}.styles.${styleId}`, errors);
    const code = style?.code;
    if (code && codes.has(code)) {
      errors.push(`${location}.styles.${styleId} code ${code} 与 ${codes.get(code)} 重复`);
    } else if (code) {
      codes.set(code, `${location}.styles.${styleId}`);
    }
  }

  for (const [key, field] of Object.entries(data.shared ?? {})) {
    checkFieldDefinition(key, field, `${location}.shared`, errors);
  }
  return data;
}

export function readEngines(cfg) {
  const root = path.join(cfg.paths.creative, "engines");
  const engines = new Map();
  const errors = [];
  const codes = new Map();

  const register = (data, location, metaFile, componentFile, scope) => {
    const meta = validateEngineData(data, location, errors, codes, engines);
    if (!meta) return;
    engines.set(meta.id, {
      ...meta,
      scope,
      file: rel(cfg.paths.creative, metaFile),
      componentFile: componentFile
        ? rel(cfg.paths.creative, componentFile)
        : null,
    });
  };

  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const metaFile = path.join(dir, "engine.json");
      if (!existsSync(metaFile)) continue;
      const componentFile = path.join(dir, "index.tsx");
      if (!existsSync(componentFile)) {
        errors.push(`engines/${entry.name}/index.tsx 缺失`);
      }
      register(
        readJson(metaFile, null),
        `engines/${entry.name}/engine.json`,
        metaFile,
        existsSync(componentFile) ? componentFile : null,
        "shared",
      );
    }
  }

  return { engines, errors };
}

export function readLocalEngine(cfg, project, errors) {
  const ref = String(project.engine ?? "");
  if (!ref.startsWith("./")) return null;
  const engineDir = path.join(project.dir, "engine");
  const metaFile = path.join(engineDir, "engine.json");
  const componentFile = path.join(engineDir, "index.tsx");
  if (!existsSync(metaFile)) {
    errors.push(`${project.file}: 本地引擎缺少 engine/engine.json`);
    return null;
  }
  if (!existsSync(componentFile)) {
    errors.push(`${project.file}: 本地引擎缺少 engine/index.tsx`);
    return null;
  }
  const data = readJson(metaFile, null);
  const meta = validateEngineData(
    data,
    `${project.id}/engine/engine.json`,
    errors,
    new Map(),
    new Map(),
  );
  if (!meta) return null;
  return {
    ...meta,
    id: meta.id ?? project.id,
    preset: meta.preset ?? project.id,
    label: meta.label || project.name,
    scope: "local",
    file: rel(cfg.paths.creative, metaFile),
    componentFile: rel(cfg.paths.creative, componentFile),
  };
}

export function projectEngine(project, engines) {
  const ref = String(project.engine ?? "");
  return ref.startsWith("./")
    ? (engines.get(project.id) ?? null)
    : (engines.get(ref) ?? null);
}

export function readCreativeProjects(cfg) {
  const root = cfg.paths.creative;
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "engines")
    .map((entry) => {
      const dir = path.join(root, entry.name);
      const file = path.join(dir, "creative.json");
      if (!existsSync(file)) return null;
      const data = readJson(file, null);
      if (!isObject(data)) return null;
      const variantsDir = path.join(dir, "variants");
      const variants = listJsonDir(variantsDir)
        .map((name) => {
          const variantFile = path.join(variantsDir, name);
          const variant = readJson(variantFile, null);
          if (!isObject(variant)) return null;
          return {
            ...variant,
            file: rel(root, variantFile),
          };
        })
        .filter(Boolean);
      return {
        ...data,
        dirName: entry.name,
        dir,
        file: rel(root, file),
        variants,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function validateProject(
  project,
  { engines, maxAssets, engine: engineOverride = null },
) {
  const errors = [];
  const warnings = [];

  if (!SLUG.test(String(project.id ?? ""))) {
    errors.push(`${project.file}: id 必须是 kebab-case`);
  } else if (project.id !== project.dirName) {
    errors.push(`${project.file}: id「${project.id}」与目录名「${project.dirName}」不一致`);
  }
  if (!project.name) errors.push(`${project.file}: name 缺失`);
  if (!(Number(project.version) > 0)) {
    errors.push(`${project.file}: version 必须是正整数`);
  }
  if (!STATUSES.has(project.status ?? "active")) {
    errors.push(`${project.file}: status 只能是 active / paused`);
  }
  const engine = engineOverride ?? engines.get(project.engine);
  if (!engine) {
    errors.push(`${project.file}: 引擎不存在：${project.engine}`);
  }
  if (!isObject(project.appliesTo)) {
    warnings.push(`${project.file}: 缺少 appliesTo，混剪不会按实拍主题匹配`);
  } else {
    checkBeatRoles(project.appliesTo.beatRoles, `${project.file}: appliesTo.beatRoles`, errors);
  }
  if (project.params !== undefined && !isObject(project.params)) {
    errors.push(`${project.file}: params 必须是对象`);
  }
  if (project.content !== undefined && !isObject(project.content)) {
    errors.push(`${project.file}: content 必须是对象`);
  }

  const seen = new Set();
  for (const variant of project.variants) {
    const where = variant.file ?? `variants/${variant.id}.json`;
    if (!SLUG.test(String(variant.id ?? ""))) {
      errors.push(`${where}: id 必须是 kebab-case`);
    }
    if (seen.has(variant.id)) errors.push(`${where}: 变体 id 重复：${variant.id}`);
    seen.add(variant.id);
    if (!variant.name) errors.push(`${where}: name 缺失`);
    if (!(Number(variant.version ?? 1) > 0)) {
      errors.push(`${where}: version 必须是正整数`);
    }
    if (!ASSET_STATUSES.has(variant.status ?? "draft")) {
      errors.push(`${where}: status 只能是 draft / approved / retired`);
    }
    checkBeatRoles(variant.beatRoles, `${where}: beatRoles`, errors);
    if (variant.params !== undefined && !isObject(variant.params)) {
      errors.push(`${where}: params 必须是对象`);
    }

    if (!engine) continue;
    if (!engine.styles?.[variant.style]) {
      errors.push(`${where}: 引擎 ${engine.id} 没有风格：${variant.style}`);
      continue;
    }

    const items = variant.items;
    if (!Array.isArray(items) || !items.length) {
      errors.push(`${where}: items 至少需要一条`);
      continue;
    }
    if (items.length > maxAssets) {
      errors.push(`${where}: items 超过上限 ${maxAssets}`);
    }

    for (const [index, item] of items.entries()) {
      if (!isObject(item)) {
        errors.push(`${where}: items[${index}] 必须是对象`);
        continue;
      }
      if (item.id !== undefined && !SLUG.test(String(item.id))) {
        errors.push(`${where}: items[${index}].id 必须是 kebab-case`);
      }
      if (item.params !== undefined && !isObject(item.params)) {
        errors.push(`${where}: items[${index}].params 必须是对象`);
        continue;
      }
      resolveParams({
        engine,
        styleId: variant.style,
        layers: [project.params, variant.params, item.params],
        location: `${where}: items[${index}]`,
        errors,
        warnings,
      });
    }
  }

  if (!project.variants.length) errors.push(`${project.file}: 至少需要一个变体`);
  return { errors, warnings };
}

export function validateAll(cfg) {
  const { engines, errors: engineErrors } = readEngines(cfg);
  const projects = readCreativeProjects(cfg);
  const maxAssets = Number(cfg.creative?.maxAssetsPerVariant ?? 24);
  const errors = [...engineErrors];
  const warnings = [];
  const usedPresets = new Set([...engines.values()].map((item) => item.preset));

  for (const project of projects) {
    let engine = null;
    if (String(project.engine ?? "").startsWith("./")) {
      engine = readLocalEngine(cfg, project, errors);
      if (engine) {
        if (usedPresets.has(engine.preset)) {
          errors.push(
            `${project.file}: 引擎键 ${engine.preset} 与已有引擎冲突`,
          );
        } else if (engines.has(project.id)) {
          errors.push(`${project.file}: 工程 id ${project.id} 与已有引擎 id 冲突`);
        } else {
          usedPresets.add(engine.preset);
          engines.set(project.id, engine);
        }
      }
    } else {
      engine = engines.get(project.engine) ?? null;
    }
    const result = validateProject(project, {
      engines,
      maxAssets,
      engine,
    });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { engines, projects, errors, warnings };
}

export function readCreativeIndex(cfg) {
  const index = new Map();
  for (const project of readCreativeProjects(cfg)) {
    index.set(
      project.id,
      new Set(project.variants.map((variant) => variant.id)),
    );
  }
  return index;
}

export function findProject(projects, id) {
  return projects.find((project) => project.id === id) ?? null;
}

export function styleMeta(engine, styleId) {
  return styleOf(engine, styleId);
}
