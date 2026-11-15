#!/usr/bin/env node
/**
 * 公共资源层（shared/）与素材库（assets/）的管理入口。
 *
 *   node run.mjs shared init [--force]   生成缺失的目录与空清单（不覆盖已有文件）
 *   node run.mjs shared status           只读：结构、条目数、缺失与未登记
 *   node run.mjs shared validate [--strict]
 *                                        校验清单/字体/音频索引；--strict 让缺失也算失败
 *
 * 规范见 docs/architecture/SHARED.md。shared/ 与 assets/ 是内容区（gitignore），
 * 结构与模板由本命令随核心分发。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import { diffAssetFiles, findAssetFile, scanAssetFiles } from "../modules/lib/assets.mjs";
import { writeRegistry } from "../modules/creative/registry.mjs";

const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "status";
const flag = (name) => argv.includes(`--${name}`);
const cfg = loadConfig([]);
const sharedRoot = cfg.paths.shared;
const rel = (file) => path.relative(cfg.paths.repo, file).split(path.sep).join("/");

const TEMPLATES = {
  "README.md": [
    "# shared · 公共资源层",
    "",
    "本目录由系统初始化、校验与统计，用户负责放入与维护资源；结构规范见 `docs/architecture/SHARED.md`。",
    "",
    "- `assets.manifest.json`：素材清单（路径 / 哈希 / 许可 / 来源 / 下载地址）",
    "- `fonts.ts`：字体清单（`FONT_MANIFEST`）",
    "- `audio/{sfx,music}.index.json`：音效与 BGM 索引",
    "- `presets/`：设计令牌与平台避让等预设（TS 模块）",
    "- `code/`：可选的公共代码（引擎 props 类型、调色板、组件）",
    "- `shots/`：镜头卡文档（参考资料）",
    "- `variation.json`：裂变变化轴",
    "- `CREDITS.md`：素材来源与许可",
    "",
    "常用命令：",
    "",
    "```bash",
    "node run.mjs shared status",
    "node run.mjs shared validate --strict",
    "node run.mjs sync --apply",
    "npm run assets:check",
    "```",
    "",
  ].join("\n"),
  "CREDITS.md": [
    "# CREDITS · 公共资源",
    "",
    "记录 `assets/` 里每个来源的许可与署名。新增素材后运行 `node tools/assets.mjs scan --apply` 登记，",
    "再把许可补进清单条目与本文。",
    "",
  ].join("\n"),
  "code/README.md": [
    "# shared/code",
    "",
    "可选的公共代码，供多个创意工程共享。典型文件：",
    "",
    "- `types.ts`：引擎 props 类型（`EngineProps` 的扩展）",
    "- `palette.ts`、`parts.tsx`、`backdrop.tsx`、`assets.ts`",
    "- `icons.json`、`world-dots.json`",
    "",
    "只被一个工程使用的代码放在该工程的 `engine/` 里，不要放这里。",
    "",
  ].join("\n"),
  "shots/README.md": [
    "# 镜头卡（参考资料）",
    "",
    "这些文档是创意参考，不参与任何运行时流程（scan / creative build / mix 都不会读）。",
    "",
    "- 设计新引擎、变体或节奏时，按 `INDEX.md` 的分类找 1–3 张相关卡片；",
    "- 只读需要的卡片，不要整目录通读；",
    "- 卡片是方法与判例，不是可复制代码；参数按横屏 1920×1080 标定。",
    "",
  ].join("\n"),
  "audio/LICENSES.md": [
    "# 音频许可",
    "",
    "记录 BGM 与音效的来源、许可与署名要求。CC BY 曲目发布时必须保留署名。",
    "",
  ].join("\n"),
  "audio/sfx.index.json": JSON.stringify({ version: 1, items: [] }, null, 2) + "\n",
  "audio/music.index.json": JSON.stringify({ version: 1, tracks: [] }, null, 2) + "\n",
  "variation.json":
    JSON.stringify(
      {
        palettes: [],
        text: {},
        particle: {},
        camera: {},
        transition: {},
        durations: {},
        rhythmProfiles: [],
      },
      null,
      2,
    ) + "\n",
  "assets.manifest.json":
    JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), assets: [] }, null, 2) +
    "\n",
  "fonts.ts": [
    'import type { FontSpec } from "../common/engine";',
    "",
    "/** 字体清单：file 相对 public/；字体文件放进素材根并在清单登记。 */",
    "export const FONT_MANIFEST: FontSpec[] = [];",
    "",
  ].join("\n"),
  "presets/design.ts": [
    "/** 项目设计令牌与平台避让区（内容预设，按项目修改）。 */",
    "",
    `export const VIDEO = { width: ${cfg.spec.width}, height: ${cfg.spec.height}, fps: ${cfg.spec.fps} } as const;`,
    "",
    "export const SAFE = {",
    "  left: 0,",
    "  right: VIDEO.width,",
    "  top: 0,",
    "  bottom: VIDEO.height,",
    "} as const;",
    "",
    "export const COLORS = { bg: \"#000000\", text: \"#FFFFFF\", accent: \"#FFFFFF\" } as const;",
    "",
    "export const TYPE = { zh: '\"Noto Sans SC\"', latin: '\"Inter\"', mono: '\"JetBrains Mono\"' } as const;",
    "",
    "export const GRID = { module: 54 } as const;",
    "",
    "export const MOTION = { beat: 0.5, quick: 0.35, slow: 0.8 } as const;",
    "",
    "export const TOKENS = { VIDEO, SAFE, COLORS, TYPE, GRID, MOTION } as const;",
    "",
  ].join("\n"),
};

function writeTemplate(relative, force) {
  const file = path.join(sharedRoot, ...relative.split("/"));
  if (existsSync(file) && !force) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, TEMPLATES[relative], "utf8");
  console.log(`[shared] + ${rel(file)}`);
  return true;
}

function init() {
  const force = flag("force");
  let created = 0;
  for (const key of Object.keys(TEMPLATES)) {
    if (writeTemplate(key, force)) created += 1;
  }
  for (const root of cfg.assetRoots) {
    if (existsSync(root)) continue;
    mkdirSync(root, { recursive: true });
    console.log(`[shared] + ${rel(root)}/`);
    created += 1;
  }
  if (!created) console.log("[shared] 结构已完整，未改动");
  else console.log(`[shared] 已生成 ${created} 项`);
  writeRegistry(cfg);
  console.log("[shared] 注册表已按 shared/fonts.ts 更新");
  console.log("[shared] 下一步：放入素材后运行 node run.mjs sync --apply");
  return 0;
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return { __error: error.message };
  }
}

function fontFiles() {
  const file = path.join(sharedRoot, "fonts.ts");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/file:\s*["']([^"']+)["']/g)].map((match) =>
    match[1].replace(/^\/?assets\//, ""),
  );
}

function countFiles(dir, predicate = () => true) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sum + countFiles(full, predicate);
    return sum + (predicate(entry.name) ? 1 : 0);
  }, 0);
}

function creativeProjects() {
  const root = cfg.paths.creative;
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => existsSync(path.join(dir, "creative.json")));
}

function statusPayload() {
  const manifest = readJson(path.join(sharedRoot, "assets.manifest.json"), { assets: [] });
  const entries = manifest.assets ?? [];
  const diff = diffAssetFiles(entries, cfg.assetRoots);
  const fonts = fontFiles();
  const fontsMissing = fonts.filter((file) => !findAssetFile(cfg.assetRoots, file));
  const sfx = readJson(path.join(sharedRoot, "audio", "sfx.index.json"), { items: [] });
  const music = readJson(path.join(sharedRoot, "audio", "music.index.json"), { tracks: [] });
  const presets = ["presets/design.ts", "presets/canvas.ts"].filter((file) =>
    existsSync(path.join(sharedRoot, ...file.split("/"))),
  );
  const code = ["types.ts", "palette.ts", "parts.tsx", "backdrop.tsx", "assets.ts", "icons.json", "world-dots.json"]
    .filter((file) => existsSync(path.join(sharedRoot, "code", file)));
  const shots = countFiles(path.join(sharedRoot, "shots"), (name) => name.endsWith(".md"));
  const withAssets = creativeProjects().filter((dir) => existsSync(path.join(dir, "assets")));

  return {
    initialized: true,
    root: rel(sharedRoot),
    manifest: {
      entries: entries.length,
      disk: diff.onDisk.size,
      added: diff.added.length,
      changed: diff.changed.length,
      missing: diff.missing.length,
    },
    fonts: { entries: fonts.length, missing: fontsMissing.length },
    audio: { sfx: (sfx.items ?? []).length, music: (music.tracks ?? []).length },
    presets,
    variation: existsSync(path.join(sharedRoot, "variation.json")),
    code,
    shots,
    projectsWithAssets: withAssets.length,
    roots: cfg.assetRoots.map((root) => {
      const { found } = scanAssetFiles([root]);
      return { path: rel(root), exists: existsSync(root), files: found.size };
    }),
  };
}

function status() {
  if (!existsSync(sharedRoot)) {
    const payload = { initialized: false, root: rel(sharedRoot) };
    if (flag("json")) {
      console.log(JSON.stringify(payload, null, 2));
      return 1;
    }
    console.log(`[shared] 未初始化：${rel(sharedRoot)}（运行 node run.mjs shared init）`);
    return 1;
  }
  const payload = statusPayload();
  if (flag("json")) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  console.log(`[shared] ${payload.root}`);
  console.log(
    `  清单：${payload.manifest.entries} 条 / 磁盘 ${payload.manifest.disk} 个文件 / 新增 ${payload.manifest.added} / 变更 ${payload.manifest.changed} / 缺失 ${payload.manifest.missing}`,
  );
  console.log(`  字体：${payload.fonts.entries} 个文件 / 缺失 ${payload.fonts.missing}`);
  console.log(`  音频：sfx ${payload.audio.sfx} / music ${payload.audio.music}`);
  console.log(`  预设：${payload.presets.length ? payload.presets.join("、") : "无"}`);
  console.log(`  变化轴：${payload.variation ? "variation.json" : "无"}`);
  console.log(`  公共代码：${payload.code.length ? payload.code.join("、") : "无"}`);
  console.log(`  镜头卡：${payload.shots} 个文档`);
  console.log(`  工程自带素材：${payload.projectsWithAssets} 个工程`);
  for (const root of payload.roots) {
    console.log(`  素材根 ${root.path}：${root.exists ? `${root.files} 个文件` : "不存在"}`);
  }
  return 0;
}

function validatePayload(strict) {
  const errors = [];
  const warnings = [];
  const manifestFile = path.join(sharedRoot, "assets.manifest.json");
  const manifest = readJson(manifestFile, null);
  if (!manifest) {
    warnings.push("缺少 assets.manifest.json（放素材后运行 node tools/assets.mjs scan --apply）");
  } else if (manifest.__error) {
    errors.push(`assets.manifest.json 无法解析：${manifest.__error}`);
  } else {
    for (const entry of manifest.assets ?? []) {
      if (!entry.path) errors.push("assets.manifest.json 有条目缺少 path");
      if (!entry.license || entry.license === "unknown") {
        warnings.push(`素材未登记许可：${entry.path}`);
      }
    }
  }

  const fonts = fontFiles();
  for (const file of fonts) {
    if (!findAssetFile(cfg.assetRoots, file)) warnings.push(`字体文件缺失：${file}`);
  }

  for (const [name, key] of [
    ["audio/sfx.index.json", "items"],
    ["audio/music.index.json", "tracks"],
  ]) {
    const file = path.join(sharedRoot, ...name.split("/"));
    if (!existsSync(file)) {
      warnings.push(`缺少 ${name}`);
      continue;
    }
    const data = readJson(file, null);
    if (data?.__error) {
      errors.push(`${name} 无法解析：${data.__error}`);
      continue;
    }
    const list = data?.[key] ?? [];
    const seen = new Set();
    for (const item of list) {
      if (!item.id) errors.push(`${name} 有条目缺少 id`);
      else if (seen.has(item.id)) errors.push(`${name} 条目 id 重复：${item.id}`);
      seen.add(item.id);
      if (!item.file) errors.push(`${name} 条目缺少 file：${item.id ?? "?"}`);
      else if (!findAssetFile(cfg.assetRoots, `${key === "items" ? "sfx" : "music"}/${item.file}`)) {
        warnings.push(`${name} 引用的文件缺失：${item.file}`);
      }
    }
  }

  if (strict) {
    for (const root of cfg.assetRoots) {
      if (!existsSync(root)) errors.push(`素材根不存在：${rel(root)}`);
    }
    for (const warning of warnings) errors.push(warning);
  }

  return { ok: errors.length === 0, strict, errors, warnings };
}

function validate() {
  const strict = flag("strict");
  if (!existsSync(sharedRoot)) {
    const payload = { ok: true, initialized: false, strict, errors: [], warnings: [] };
    if (flag("json")) {
      console.log(JSON.stringify(payload, null, 2));
      return 0;
    }
    console.log(`[shared] 未初始化：${rel(sharedRoot)}（空核心合法）`);
    return 0;
  }
  const payload = validatePayload(strict);
  if (flag("json")) {
    console.log(JSON.stringify(payload, null, 2));
    return payload.ok ? 0 : 1;
  }
  for (const error of payload.errors) console.error(`  ✗ ${error}`);
  for (const warning of payload.warnings) console.warn(`  ! ${warning}`);
  console.log(
    `[shared] 校验：错误 ${payload.errors.length} / 警告 ${payload.warnings.length}${strict ? "（strict）" : ""}`,
  );
  return payload.ok ? 0 : 1;
}

const code =
  command === "init"
    ? init()
    : command === "status"
      ? status()
      : command === "validate"
        ? validate()
        : (console.log("用法：node run.mjs shared init|status|validate [--force] [--strict]"), 1);
process.exit(code);
