#!/usr/bin/env node
/**
 * 公共资源层（shared/）与素材库（assets/）的管理入口。
 *
 *   node run.mjs shared init [--force]   生成缺失的目录与空清单（不覆盖已有文件）
 *   node run.mjs shared status [--json]  只读：结构、条目数、缺失与未登记
 *   node run.mjs shared validate [--strict] [--json]
 *                                        校验清单/字体/音频索引；--strict 让缺失也算失败
 *   node run.mjs shared fonts [--write]  从清单字体条目生成 shared/fonts.ts
 *   node run.mjs shared requirements [--json] [--strict]
 *                                        校验 shared/requirements.json 的资源缺口
 *   node run.mjs shared credits [--write] [--force]
 *                                        从清单生成 shared/CREDITS.md
 *
 * 规范见 docs/architecture/SHARED.md。shared/ 与 assets/ 是内容区（gitignore），
 * 结构与模板由本命令随核心分发；资源由用户用 assets add / fetch 提供。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import {
  diffAssetFiles,
  ensureAssetDirs,
  findAssetFile,
  renderCredits,
  resolveAudioFile,
  scanAssetFiles,
} from "../modules/lib/assets.mjs";
import {
  ensureFontMeta,
  fontEntries,
  renderFontsTs,
  writeFontsTs,
} from "../modules/lib/fonts.mjs";
import { requirementsStatus } from "../modules/lib/resources.mjs";
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
    "- `fonts.ts`：字体清单（`FONT_MANIFEST`，由清单生成）",
    "- `requirements.json`：内容侧资源需求（字体族、音效类别、BGM 情绪、kind 数量）",
    "- `audio/{sfx,music}.index.json`：音效与 BGM 索引",
    "- `presets/`：设计令牌与平台避让等预设（TS 模块）",
    "- `code/`：可选的公共代码（引擎 props 类型、调色板、组件）",
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
  "requirements.json":
    JSON.stringify(
      {
        version: 1,
        fonts: [],
        audio: { sfx: [], musicMoods: [] },
        kinds: {},
      },
      null,
      2,
    ) + "\n",
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

function creditsExtras() {
  const extras = [];
  if (existsSync(path.join(cfg.paths.repo, "docs", "reference", "shots"))) {
    extras.push(
      "## 镜头卡",
      "",
      "- 来源：video-shotcraft；许可：Apache 2.0；见 `docs/reference/shots/LICENSE` 与 `ATTRIBUTION.md`。",
    );
  }
  if (existsSync(path.join(sharedRoot, "code", "canvas-engine"))) {
    extras.push(
      "## Canvas 绘制引擎",
      "",
      "- `shared/code/canvas-engine/engine.js`：作者自有代码，随内容包使用。",
    );
  }
  return extras;
}

function init() {
  const force = flag("force");
  let created = 0;
  let wroteTemplateCredits = false;
  for (const key of Object.keys(TEMPLATES)) {
    if (writeTemplate(key, force)) {
      created += 1;
      if (key === "CREDITS.md") wroteTemplateCredits = true;
    }
  }
  const dirs = ensureAssetDirs(cfg.assetRoots);
  for (const dir of dirs) console.log(`[shared] + ${rel(dir)}/`);
  created += dirs.length;

  const manifestFile = path.join(sharedRoot, "assets.manifest.json");
  const creditsFile = path.join(sharedRoot, "CREDITS.md");
  if (existsSync(manifestFile) && (!existsSync(creditsFile) || wroteTemplateCredits)) {
    const manifest = readJson(manifestFile, { assets: [] });
    mkdirSync(path.dirname(creditsFile), { recursive: true });
    writeFileSync(creditsFile, renderCredits(manifest.assets ?? [], { extras: creditsExtras() }));
    if (!wroteTemplateCredits) {
      console.log(`[shared] + ${rel(creditsFile)}`);
      created += 1;
    } else {
      console.log(`[shared] CREDITS 已按清单生成：${rel(creditsFile)}`);
    }
  }

  if (existsSync(manifestFile) && fontEntries(readJson(manifestFile, { assets: [] })).length) {
    const data = readJson(manifestFile, { assets: [] });
    const metaChanged = ensureFontMeta(data);
    if (metaChanged) {
      writeFileSync(manifestFile, `${JSON.stringify(data, null, 2)}\n`);
      console.log(`[shared] 字体元数据已补入 ${rel(manifestFile)}`);
    }
    const fonts = writeFontsTs(cfg, data, { write: true });
    console.log(
      fonts.written
        ? `[shared] 字体清单已生成：${rel(fonts.file)}（${fonts.entries} 条）`
        : `[shared] 字体清单最新：${rel(fonts.file)}（${fonts.entries} 条）`,
    );
  }

  if (!created) console.log("[shared] 结构已完整，未改动");
  else console.log(`[shared] 已生成 ${created} 项`);
  writeRegistry(cfg);
  console.log("[shared] 注册表已按 shared/fonts.ts 更新");
  console.log("[shared] 下一步：node tools/assets.mjs add <文件|目录|URL> 导入资源，或 node run.mjs sync --apply");
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

const manifestSnapshot = (manifest) => {
  const snapshot = structuredClone(manifest ?? { assets: [] });
  ensureFontMeta(snapshot);
  return snapshot;
};

function fontsStale(manifest) {
  if (!fontEntries(manifest).length) return false;
  const file = path.join(sharedRoot, "fonts.ts");
  if (!existsSync(file)) return true;
  return readFileSync(file, "utf8") !== renderFontsTs(manifestSnapshot(manifest));
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
    fonts: { entries: fonts.length, missing: fontsMissing.length, stale: fontsStale(manifest) },
    audio: { sfx: (sfx.items ?? []).length, music: (music.tracks ?? []).length },
    presets,
    variation: existsSync(path.join(sharedRoot, "variation.json")),
    code,
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
  console.log(
    `  字体：${payload.fonts.entries} 个文件 / 缺失 ${payload.fonts.missing}${payload.fonts.stale ? " / 清单已过期" : ""}`,
  );
  console.log(`  音频：sfx ${payload.audio.sfx} / music ${payload.audio.music}`);
  console.log(`  预设：${payload.presets.length ? payload.presets.join("、") : "无"}`);
  console.log(`  变化轴：${payload.variation ? "variation.json" : "无"}`);
  console.log(`  公共代码：${payload.code.length ? payload.code.join("、") : "无"}`);
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
    }
  }

  const fonts = fontFiles();
  for (const file of fonts) {
    if (!findAssetFile(cfg.assetRoots, file)) warnings.push(`字体文件缺失：${file}`);
  }
  if (manifest && !manifest.__error && fontsStale(manifest)) {
    warnings.push("shared/fonts.ts 与素材清单不一致（运行 node run.mjs shared fonts --write）");
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
      else if (!resolveAudioFile(cfg.assetRoots, key === "items" ? "sfx" : "music", item.file)) {
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

function fonts() {
  const manifestFile = path.join(sharedRoot, "assets.manifest.json");
  if (!existsSync(manifestFile)) {
    console.log("[shared] 没有清单：先运行 node run.mjs shared init");
    return 1;
  }
  const manifest = readJson(manifestFile, { assets: [] });
  if (manifest.__error) {
    console.error(`[shared] assets.manifest.json 无法解析：${manifest.__error}`);
    return 1;
  }
  const count = fontEntries(manifest).length;
  const metaChanged = ensureFontMeta(manifest);
  const write = flag("write");
  const result = writeFontsTs(cfg, manifest, { write });
  if (flag("json")) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          entries: count,
          file: rel(result.file),
          changed: result.changed,
          written: result.written,
          manifestUpdated: write ? metaChanged : false,
        },
        null,
        2,
      ),
    );
    return 0;
  }
  if (!write) {
    console.log(result.text);
    console.log(
      `[shared] dry-run：${count} 条字体；加 --write 写入 ${rel(result.file)}`,
    );
    return 0;
  }
  if (metaChanged) {
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[shared] 字体元数据已补入 ${rel(manifestFile)}`);
  }
  console.log(
    result.written
      ? `[shared] 已写 ${rel(result.file)}（${count} 条）`
      : `[shared] ${rel(result.file)} 已是最新（${count} 条）`,
  );
  return 0;
}

function requirements() {
  const payload = requirementsStatus(cfg);
  const strict = flag("strict");
  if (flag("json")) {
    console.log(JSON.stringify(payload, null, 2));
    return payload.ok || !strict ? 0 : 1;
  }
  if (!payload.declared) {
    console.log(`[shared] 未声明 requirements.json（可选）：${payload.file}`);
    return 0;
  }
  if (payload.error) {
    console.error(`[shared] requirements.json 无法解析：${payload.error}`);
    return 1;
  }
  for (const item of payload.present) {
    console.log(`  ✓ ${item.type} ${item.label}`);
  }
  for (const item of payload.missing) {
    console.log(`  ✗ ${item.type} ${item.label}`);
  }
  console.log(
    `[shared] 需求：满足 ${payload.present.length} / 缺失 ${payload.missing.length}`,
  );
  return payload.ok || !strict ? 0 : 1;
}

function credits() {
  const manifestFile = path.join(sharedRoot, "assets.manifest.json");
  if (!existsSync(manifestFile)) {
    console.log("[shared] 没有清单：先运行 node run.mjs shared init 或 node run.mjs sync --apply");
    return 1;
  }
  const manifest = readJson(manifestFile, { assets: [] });
  const entries = manifest.assets ?? [];
  const file = path.join(sharedRoot, "CREDITS.md");
  const text = renderCredits(entries, { extras: creditsExtras() });
  if (!flag("write")) {
    console.log(text);
    console.log(`[shared] dry-run：加 --write 写入 ${rel(file)}`);
    return 0;
  }
  if (existsSync(file) && !flag("force")) {
    console.error(`${rel(file)} 已存在；确认覆盖加 --force`);
    return 1;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`[shared] 已写 ${rel(file)}（${entries.length} 条）`);
  return 0;
}

const code =
  command === "init"
    ? init()
    : command === "status"
      ? status()
      : command === "validate"
        ? validate()
        : command === "fonts"
          ? fonts()
          : command === "requirements"
            ? requirements()
            : command === "credits"
              ? credits()
              : (console.log(
                  "用法：node run.mjs shared init|status|validate|fonts|requirements|credits [--force] [--strict] [--json] [--write]",
                ), 1);
process.exit(code);
