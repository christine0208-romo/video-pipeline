#!/usr/bin/env node
/**
 * 素材库脚手架、导入与部署：
 *   node tools/assets.mjs init                 创建素材根与标准一级目录
 *   node tools/assets.mjs add <file|dir|url> [...] [--keep] [--kind K] [--license L] [--source S] [--name N] [--family F] [--weight N] [--force]
 *                                              导入一个或多个目标并自动登记；--keep 保留目录原结构；
 *                                              字体自动生成 shared/fonts.ts，音频自动编入索引
 *   node tools/assets.mjs remove <path> [--keep-file]
 *                                              取消清单/音频索引登记，默认删除磁盘文件
 *   node tools/assets.mjs font list              列出清单里的字体条目
 *   node tools/assets.mjs font set <path> [--family F] [--weight N] [--style italic]
 *                                              修正字体元数据并重写 shared/fonts.ts
 *   node tools/assets.mjs audio scan [--apply]  把 assets/music、assets/sfx 中未编入索引的文件登记
 *   node tools/assets.mjs audio set <id> [--bpm N] [--mood X] [--energy X] [--category X] [--gain N] [--roles a,b]
 *   node tools/assets.mjs audio list             列出 music / sfx 索引条目
 *   node tools/assets.mjs check [--verify] [--strict] [--allow-missing] [--json] [--licenses] [--meta]
 *   node tools/assets.mjs scan [--apply] [--prune] [--check]
 *   node tools/assets.mjs credits [--write] [--force]
 *   node tools/assets.mjs fetch [--download] [--from <dir>] [--force]
 *   node tools/assets.mjs list
 *
 * 素材根：config/pipeline.json 的 assets.roots（可用 --asset-roots 覆盖）
 * 清单：shared/assets.manifest.json（公共资源层；可用 --manifest 指定）
 *
 * 没有清单时：scan --apply 会从素材根生成清单（license/source 可选）；
 * check / fetch / list 只报告未登记文件并以 0 退出（--strict 时未登记视为失败）。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KIND_BY_DIR,
  diffAssetFiles,
  ensureAssetDirs,
  findAssetFile,
  normalizeAssetPath,
  renderCredits,
  resolveAudioFile,
  scanAssetFiles,
  sha256,
  walkFiles,
} from "../modules/lib/assets.mjs";
import {
  ensureFontMeta,
  isFontEntry,
  writeFontsTs,
} from "../modules/lib/fonts.mjs";
import { checkResources } from "../modules/lib/resources.mjs";
import { loadConfig } from "../modules/lib/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const command = argv[0]?.startsWith("-") ? "check" : (argv[0] ?? "check");
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const cfg = loadConfig(argv);
const manifestFile = value("manifest")
  ? path.resolve(value("manifest"))
  : path.join(cfg.paths.shared, "assets.manifest.json");

const roots = cfg.assetRoots;
const primaryRoot = roots[0];
const manifestExists = existsSync(manifestFile);
const manifest = manifestExists
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : { version: 1, assets: [] };
const entriesOf = () => (manifest.assets ??= []);

const ASSETS_README = [
  "# 素材库（assets）",
  "",
  "素材文件放在这里；一级目录决定 `kind`：",
  "",
  "- `fonts/`、`icons/`、`music/`、`sfx/`、`brand/`、`map/`",
  "",
  "新增或替换文件后：",
  "",
  "```bash",
  "node tools/assets.mjs add <文件|目录|URL> --license <许可>   # 复制并自动登记",
  "node run.mjs sync --apply      # 或先把文件放入本目录，再登记",
  "npm run assets:check           # 缺失 / 未登记 / 哈希",
  "node run.mjs shared credits --write --force   # 重新生成 shared/CREDITS.md",
  "```",
  "",
  "许可与来源是可选字段；需要署名时在清单里补 license/source，再重新生成 CREDITS。",
  "完整规则见 `docs/architecture/SHARED.md`。",
  "",
].join("\n");

function init() {
  const created = ensureAssetDirs(roots);
  for (const dir of created) console.log(`[assets] + ${rel(dir)}/`);
  const readme = path.join(primaryRoot, "README.md");
  let wroteReadme = false;
  if (!existsSync(readme)) {
    mkdirSync(path.dirname(readme), { recursive: true });
    writeFileSync(readme, ASSETS_README);
    console.log(`[assets] + ${rel(readme)}`);
    wroteReadme = true;
  }
  if (!created.length && !wroteReadme) console.log("[assets] 目录已完整，未改动");
  console.log("[assets] 放入文件后运行 node run.mjs sync --apply；规范见 docs/architecture/SHARED.md");
  return 0;
}

function creditsText() {
  const extras = [];
  if (existsSync(path.join(cfg.paths.repo, "docs", "reference", "shots"))) {
    extras.push(
      "## 镜头卡",
      "",
      "- 来源：video-shotcraft；许可：Apache 2.0；见 `docs/reference/shots/LICENSE` 与 `ATTRIBUTION.md`。",
    );
  }
  if (existsSync(path.join(cfg.paths.shared, "code", "canvas-engine"))) {
    extras.push(
      "## Canvas 绘制引擎",
      "",
      "- `shared/code/canvas-engine/engine.js`：作者自有代码，随内容包使用。",
    );
  }
  return renderCredits(entriesOf(), { extras });
}

function writeCreditsFile() {
  const file = path.join(cfg.paths.shared, "CREDITS.md");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, creditsText());
  return file;
}

function credits() {
  if (!manifestExists) {
    console.log("[assets] 没有清单：先运行 node run.mjs shared init 或 node run.mjs sync --apply");
    return 1;
  }
  const entries = entriesOf();
  const text = creditsText();
  const file = path.join(cfg.paths.shared, "CREDITS.md");
  if (!flag("write")) {
    console.log(text);
    console.log(`[assets] dry-run：加 --write 写入 ${rel(file)}`);
    return 0;
  }
  if (existsSync(file) && !flag("force")) {
    console.error(`${rel(file)} 已存在；确认覆盖加 --force`);
    return 1;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(`[assets] 已写 ${rel(file)}（${entries.length} 条）`);
  return 0;
}

function removeAsset(target) {
  const relative = normalizeAssetPath(target);
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
    console.error("路径必须是素材根内的相对路径");
    return 1;
  }
  const entryIndex = entriesOf().findIndex((entry) => entry.path === relative);
  const file = findAssetFile(roots, relative);
  const indexChanges = [];

  for (const kind of Object.keys(AUDIO_KINDS)) {
    const index = readAudioIndex(kind);
    if (!index) return 1;
    const key = AUDIO_KINDS[kind].key;
    const entries = index[key] ?? [];
    const next = entries.filter((entry) => {
      const resolved = resolveAudioFile(roots, kind, entry.file);
      return !(
        entry.file === relative ||
        (resolved && resolved.relative === relative)
      );
    });
    if (next.length !== entries.length) {
      index[key] = next;
      index.generatedAt = new Date().toISOString();
      writeFileSync(audioIndexFile(kind), `${JSON.stringify(index, null, 2)}\n`);
      indexChanges.push(kind);
    }
  }

  if (entryIndex < 0 && !file && !indexChanges.length) {
    console.error(`清单、音频索引和磁盘都没有这个素材：${relative}`);
    return 1;
  }

  if (entryIndex >= 0) entriesOf().splice(entryIndex, 1);
  let deleted = false;
  if (!flag("keep-file") && file) {
    unlinkSync(file);
    deleted = true;
  }

  if (entryIndex >= 0 || manifestExists) {
    mkdirSync(path.dirname(manifestFile), { recursive: true });
    manifest.generatedAt = new Date().toISOString();
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (manifestExists) {
    writeFontsTs(cfg, manifest, { write: true });
  }
  const creditsFile = path.join(cfg.paths.shared, "CREDITS.md");
  if (manifestExists && existsSync(creditsFile)) {
    writeFileSync(creditsFile, creditsText());
  }

  console.log(
    `[assets] 已移除 ${relative}：清单 ${entryIndex >= 0 ? "已取消登记" : "未登记"} / 音频索引 ${indexChanges.length ? indexChanges.join("、") : "无"} / 文件 ${deleted ? "已删除" : file ? "已保留（--keep-file）" : "不存在"} / fonts.ts 与 CREDITS 已同步`,
  );
  return 0;
}

const KIND_BY_EXT = {
  ".otf": "fonts",
  ".ttf": "fonts",
  ".woff": "fonts",
  ".woff2": "fonts",
  ".svg": "icons",
  ".png": "brand",
  ".jpg": "brand",
  ".jpeg": "brand",
  ".webp": "brand",
  ".avif": "brand",
  ".mp3": "music",
  ".m4a": "music",
  ".ogg": "music",
  ".flac": "music",
  ".wav": "sfx",
  ".json": "map",
};

const kindOf = (file) => KIND_BY_EXT[path.extname(file).toLowerCase()] ?? "brand";

const AUDIO_KINDS = {
  music: { index: "music.index.json", key: "tracks" },
  sfx: { index: "sfx.index.json", key: "items" },
};

const AUDIO_EXT = new Set([".mp3", ".m4a", ".ogg", ".flac", ".wav"]);

/** 一级目录 music/sfx 优先；其余按扩展名：.wav 视为音效，其他视为音乐。 */
function audioKindOf(relative) {
  const top = relative.split("/")[0];
  if (top === "music" || top === "sfx") return top;
  return path.extname(relative).toLowerCase() === ".wav" ? "sfx" : "music";
}

function audioIndexFile(kind) {
  return path.join(cfg.paths.shared, "audio", AUDIO_KINDS[kind].index);
}

function readAudioIndex(kind) {
  const file = audioIndexFile(kind);
  if (!existsSync(file)) return { version: 1, [AUDIO_KINDS[kind].key]: [] };
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`[audio] ${rel(file)} 无法解析：${error.message}`);
    return null;
  }
}

function probeAudioDuration(file) {
  const result = spawnSync(
    cfg.tools.ffprobe,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    { encoding: "utf8" },
  );
  const value = Number(String(result.stdout ?? "").trim());
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
}

function slug(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "audio"
  );
}

function uniqueId(existing, base) {
  const ids = new Set(existing.map((entry) => entry.id));
  if (!ids.has(base)) return base;
  let index = 2;
  while (ids.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function audioScan(apply = false) {
  const audioFiles = [];
  const seen = new Set();
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (!AUDIO_EXT.has(path.extname(relative).toLowerCase())) continue;
      if (seen.has(relative)) continue;
      seen.add(relative);
      audioFiles.push({ relative, file, kind: audioKindOf(relative) });
    }
  }

  let added = 0;
  let missing = 0;
  for (const kind of Object.keys(AUDIO_KINDS)) {
    const index = readAudioIndex(kind);
    if (!index) return 1;
    const entries = (index[AUDIO_KINDS[kind].key] ??= []);
    const known = new Set();
    for (const entry of entries) {
      const resolved = resolveAudioFile(roots, kind, entry.file);
      known.add(resolved ? resolved.relative : normalizeAssetPath(entry.file));
    }
    const fresh = audioFiles.filter(
      (item) => item.kind === kind && !known.has(item.relative),
    );
    for (const item of fresh) {
      if (!apply) {
        console.log(`未编入 ${kind} 索引：${item.relative}（运行 audio scan --apply 登记）`);
        missing += 1;
        continue;
      }
      const manifestEntry = entriesOf().find((entry) => entry.path === item.relative);
      const base = {
        id: uniqueId(entries, slug(path.basename(item.relative, path.extname(item.relative)))),
        file: item.relative,
        duration: probeAudioDuration(item.file) ?? 0,
      };
      const entry =
        kind === "music"
          ? {
              ...base,
              title: path.basename(item.relative, path.extname(item.relative)),
              artist: manifestEntry?.source ?? "user",
              license: manifestEntry?.license ?? "unknown",
              bpm: null,
              mood: "unknown",
              energy: "unknown",
              roles: [],
              loop: false,
            }
          : {
              ...base,
              category: "unknown",
              gain: 0.8,
              tags: [],
              license: manifestEntry?.license ?? "unknown",
              source: manifestEntry?.source ?? "user",
            };
      entries.push(entry);
      known.add(item.relative);
      console.log(`[audio] + ${kind}/${entry.id} (${entry.file})`);
      added += 1;
    }
    if (apply && fresh.length) {
      index.generatedAt = new Date().toISOString();
      mkdirSync(path.dirname(audioIndexFile(kind)), { recursive: true });
      writeFileSync(audioIndexFile(kind), `${JSON.stringify(index, null, 2)}\n`);
    }
  }
  if (!apply) {
    console.log(`[audio] 未编入 ${missing} 个文件；加 --apply 登记（music 默认 mood/energy=unknown，sfx 默认 category=unknown）`);
  } else {
    console.log(`[audio] 新登记 ${added} 个音频；按需补 bpm/mood/energy/category 后用 audio set`);
  }
  return 0;
}

function audioSet(id) {
  if (!id) {
    console.log("用法：node tools/assets.mjs audio set <id> [--kind music|sfx] [--category X] [--gain N] [--bpm N] [--mood X] [--energy X] [--roles a,b] [--title X] [--artist X] [--license X]");
    return 1;
  }
  const wantedKind = value("kind");
  for (const kind of wantedKind ? [wantedKind] : Object.keys(AUDIO_KINDS)) {
    const index = readAudioIndex(kind);
    if (!index) return 1;
    const entries = index[AUDIO_KINDS[kind].key] ?? [];
    const entry = entries.find((item) => item.id === id);
    if (!entry) continue;
    for (const key of ["category", "mood", "energy", "title", "artist", "license"]) {
      const next = value(key);
      if (next !== null) entry[key] = next;
    }
    for (const key of ["gain", "bpm"]) {
      const next = value(key);
      if (next !== null) entry[key] = Number(next);
    }
    const roles = value("roles");
    if (roles !== null) entry.roles = String(roles).split(",").map((item) => item.trim()).filter(Boolean);
    writeFileSync(audioIndexFile(kind), `${JSON.stringify(index, null, 2)}\n`);
    console.log(`[audio] 已更新 ${kind}/${entry.id}：${JSON.stringify(entry)}`);
    return 0;
  }
  console.error(`[audio] 找不到条目：${id}（用 node tools/assets.mjs audio list 查看）`);
  return 1;
}

function audioList() {
  for (const kind of Object.keys(AUDIO_KINDS)) {
    const index = readAudioIndex(kind);
    if (!index) return 1;
    for (const entry of index[AUDIO_KINDS[kind].key] ?? []) {
      const meta =
        kind === "music"
          ? `bpm=${entry.bpm ?? "—"} mood=${entry.mood ?? "—"} energy=${entry.energy ?? "—"}`
          : `category=${entry.category ?? "—"} gain=${entry.gain ?? "—"}`;
      console.log(`${kind}\t${entry.id}\t${entry.file}\t${meta}`);
    }
  }
  return 0;
}

function audioCommand(subcommand = "scan") {
  if (subcommand === "scan") return audioScan(flag("apply"));
  if (subcommand === "set") return audioSet(argv[2]);
  if (subcommand === "list") return audioList();
  console.log("用法：node tools/assets.mjs audio scan [--apply] | audio set <id> [flags] | audio list");
  return 1;
}

function fontList() {
  const fonts = entriesOf().filter(isFontEntry);
  if (!fonts.length) {
    console.log("[font] 清单里没有字体条目");
    return 0;
  }
  for (const entry of fonts) {
    console.log(
      `${entry.path}\t${entry.family ?? "—"}\t${entry.weight ?? "—"}\t${entry.style ?? "—"}`,
    );
  }
  return 0;
}

function fontSet(target) {
  if (!target) {
    console.log(
      "用法：node tools/assets.mjs font set <path> [--family X] [--weight N] [--style italic] [--manifest <file>]",
    );
    return 1;
  }
  const clean = normalizeAssetPath(target);
  const entry = entriesOf().find(
    (item) => isFontEntry(item) && item.path === clean,
  );
  if (!entry) {
    console.error(`[font] 清单里找不到字体：${clean}（用 node tools/assets.mjs font list 查看）`);
    return 1;
  }
  if (!manifestExists) {
    console.log("[assets] 没有清单：先运行 node run.mjs shared init");
    return 1;
  }
  ensureFontMeta(manifest);
  for (const key of ["family", "style"]) {
    const next = value(key);
    if (next !== null) entry[key] = String(next);
  }
  const weight = value("weight");
  if (weight !== null) entry.weight = String(weight);
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const fonts = writeFontsTs(cfg, manifest, { write: true });
  console.log(
    `[font] ${entry.path}：family=${entry.family} weight=${entry.weight}${entry.style ? ` style=${entry.style}` : ""}；${rel(fonts.file)} ${fonts.written ? "已更新" : "已最新"}`,
  );
  return 0;
}

function fontCommand(subcommand = "list") {
  if (subcommand === "list") return fontList();
  if (subcommand === "set") return fontSet(argv[2]);
  console.log("用法：node tools/assets.mjs font list | font set <path> [--family X] [--weight N] [--style italic]");
  return 1;
}

function upsertEntry(relative, data, options) {
  const posix = relative.split(path.sep).join("/");
  const assets = entriesOf();
  const existing = assets.find((entry) => entry.path === posix);
  const info = { size: data.length, sha256: sha256(data) };
  const fontMeta = {
    ...(options.family ? { family: options.family } : {}),
    ...(options.weight !== null && options.weight !== undefined
      ? { weight: String(options.weight) }
      : {}),
    ...(options.style ? { style: options.style } : {}),
  };
  const providerMeta = {
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.ref ? { providerRef: options.ref } : {}),
  };
  if (existing) {
    const next = { ...existing, ...info, provided: true };
    if (options.kind) next.kind = options.kind;
    if (options.license) next.license = options.license;
    if (options.source) next.source = options.source;
    if (options.url) next.url = options.url;
    Object.assign(next, fontMeta);
    Object.assign(next, providerMeta);
    Object.assign(existing, next);
    return "updated";
  }
  assets.push({
    path: posix,
    kind: options.kind,
    ...info,
    url: options.url ?? null,
    license: options.license ?? "unknown",
    source: options.source ?? "user",
    provided: true,
    ...fontMeta,
    ...providerMeta,
  });
  return "added";
}

const ADD_VALUE_FLAGS = new Set([
  "config",
  "manifest",
  "kind",
  "license",
  "source",
  "name",
  "family",
  "weight",
  "style",
  "provider",
  "ref",
  "file",
]);

function addTargets() {
  const targets = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (ADD_VALUE_FLAGS.has(key) && argv[i + 1] && !argv[i + 1].startsWith("--")) {
        i += 1;
      }
      continue;
    }
    targets.push(arg);
  }
  return targets;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 下载重试：429 与 5xx 退避重试，其余状态原样返回给调用方报错。 */
async function fetchWithRetry(url, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (response.status !== 429 && response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts - 1) await sleep(800 * (attempt + 1));
  }
  throw lastError;
}

async function add() {
  const targets = addTargets();
  if (!targets.length && value("file")) targets.push(value("file"));
  if (!targets.length) {
    console.log(
      "用法：node tools/assets.mjs add <file|dir|url> [更多目标...] [--keep] [--kind fonts|icons|music|sfx|brand|map] [--license X] [--source X] [--name X] [--family X] [--weight N] [--style italic] [--force]",
    );
    return 1;
  }
  const force = flag("force");
  const keep = flag("keep");
  const license = value("license");
  const sourceLabel = value("source");
  const kindOverride = value("kind");
  const family = value("family");
  const weight = value("weight");
  const style = value("style");
  const providerId = value("provider");
  const providerRef = value("ref");
  const files = [];
  let failed = 0;

  for (const target of targets) {
    if (/^https?:\/\//i.test(target)) {
      let response;
      try {
        response = await fetchWithRetry(target);
      } catch (error) {
        console.error(`下载失败 ${target}：${error.message}`);
        failed += 1;
        continue;
      }
      if (!response.ok) {
        console.error(`下载失败 ${target}：HTTP ${response.status}`);
        failed += 1;
        continue;
      }
      const name = value("name") ?? (path.basename(new URL(target).pathname) || "download");
      const kind = kindOverride ?? kindOf(name);
      files.push({
        relative: path.join(kind, name),
        data: Buffer.from(await response.arrayBuffer()),
        url: target,
      });
      continue;
    }
    const absolute = path.resolve(target);
    if (!existsSync(absolute)) {
      console.error(`找不到：${absolute}`);
      failed += 1;
      continue;
    }
    if (statSync(absolute).isDirectory()) {
      for (const file of walkFiles(absolute)) {
        const relative = path.relative(absolute, file);
        const top = relative.split(path.sep)[0];
        const organized = Boolean(KIND_BY_DIR[top]);
        const destination =
          keep || organized
            ? relative
            : path.join(kindOverride ?? kindOf(file), relative);
        files.push({ relative: destination, data: readFileSync(file), url: null });
      }
    } else {
      const kind = kindOverride ?? kindOf(absolute);
      files.push({
        relative: path.join(kind, path.basename(absolute)),
        data: readFileSync(absolute),
        url: null,
      });
    }
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let hasAudio = false;
  for (const file of files) {
    if (AUDIO_EXT.has(path.extname(file.relative).toLowerCase())) hasAudio = true;
    const dest = path.join(primaryRoot, file.relative);
    if (existsSync(dest) && !force) {
      console.log(`跳过（已存在，--force 覆盖）：${file.relative.split(path.sep).join("/")}`);
      skipped += 1;
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, file.data);
    const result = upsertEntry(file.relative, file.data, {
      kind: KIND_BY_DIR[file.relative.split(path.sep)[0]] ?? kindOf(file.relative),
      license,
      source: sourceLabel,
      url: file.url,
      family,
      weight,
      style,
      provider: providerId,
      ref: providerRef,
    });
    if (result === "added") added += 1;
    else updated += 1;
    console.log(`[assets] + ${file.relative.split(path.sep).join("/")}`);
  }

  if (!files.length && !failed) console.log("[assets] 目标里没有可导入的文件");
  const fontTargeted = files.some((file) => isFontEntry({ path: file.relative }));
  const metaChanged = fontTargeted ? ensureFontMeta(manifest) : false;
  if (added || updated || metaChanged) {
    mkdirSync(path.dirname(manifestFile), { recursive: true });
    manifest.generatedAt = new Date().toISOString();
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (fontTargeted) {
    const fonts = writeFontsTs(cfg, manifest, { write: true });
    console.log(
      `[assets] 字体清单${fonts.written ? "已更新" : "最新"}：${rel(fonts.file)}（${fonts.entries} 条；改 family 用 node tools/assets.mjs font set <path> --family X）`,
    );
  }
  if (added || updated || metaChanged) {
    const creditsFile = writeCreditsFile();
    console.log(`[assets] CREDITS 已更新：${rel(creditsFile)}`);
  }
  console.log(
    `[assets] 新增 ${added} / 更新 ${updated} / 跳过 ${skipped} / 失败 ${failed}；需要署名时可在清单补 license/source，再运行 node run.mjs shared credits --write --force`,
  );
  if (hasAudio) audioScan(true);
  return failed ? 1 : 0;
}

function unregisteredMessage() {
  const { found } = scanAssetFiles(roots);
  if (!found.size) {
    console.log(`[assets] 没有内容包清单（${rel(manifestFile)}），素材根为空`);
    return 0;
  }
  console.log(
    `[assets] 没有内容包清单：素材根里有 ${found.size} 个文件；运行 node tools/assets.mjs scan --apply 生成清单`,
  );
  return flag("strict") ? 1 : 0;
}

function checkExit(report, { allowMissing, strict }) {
  if (report.badHash.length || report.brokenAudio.length || report.fontsStale) return 1;
  if (!allowMissing && report.missing.length) return 1;
  if (
    strict &&
    (report.unregistered.length ||
      report.changed.length ||
      report.licenses.unknown.length ||
      report.meta.fonts.length ||
      report.meta.audio.length)
  ) {
    return 1;
  }
  return 0;
}

function printLicenseMeta(report) {
  for (const item of report.licenses.unknown) {
    console.log(`许可未知 ${item.path} (${item.kind}) — 可在清单补 license`);
  }
  for (const item of report.meta.fonts) {
    console.log(`字体元数据缺失 ${item.path} — 用 assets font set 补 family/weight`);
  }
  for (const item of report.meta.audio) {
    console.log(
      `音频元数据缺失 ${item.kind}/${item.id} — 缺 ${item.missing.join(", ")}；用 audio set 补`,
    );
  }
  console.log(
    `[assets] 许可未知 ${report.licenses.unknown.length} / 字体元数据缺失 ${report.meta.fonts.length} / 音频元数据缺失 ${report.meta.audio.length}`,
  );
}

function check(verify = false) {
  if (!manifestExists) {
    if (flag("json")) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            manifest: false,
            entries: 0,
            roots: roots.map(rel),
            missing: [],
            unregistered: [],
            changed: [],
            badHash: [],
            licenses: { unknown: [] },
            meta: { fonts: [], audio: [] },
            brokenAudio: [],
            fontsStale: false,
          },
          null,
          2,
        ),
      );
      return 0;
    }
    return unregisteredMessage();
  }
  const allowMissing = flag("allow-missing");
  const report = checkResources(cfg, { verify });
  const exit = checkExit(report, { allowMissing, strict: flag("strict") });

  if (flag("json")) {
    console.log(JSON.stringify(report, null, 2));
    return exit;
  }
  if (flag("licenses") || flag("meta")) {
    printLicenseMeta(report);
    return exit;
  }

  for (const item of report.missing) {
    const how = item.url ? "可 --download" : "需用户提供（--from <dir>）";
    console.log(`缺少 ${item.path} (${item.kind}) — ${how}`);
  }
  for (const item of report.badHash) {
    console.log(`哈希不符 ${item.path} — 期望 ${item.expected}，实际 ${item.actual}`);
  }
  for (const item of report.unregistered) {
    console.log(`未登记 ${item.path} — 运行 node tools/assets.mjs scan --apply`);
  }
  for (const item of report.brokenAudio) {
    console.log(`音频文件缺失 ${item.kind}/${item.id} — ${item.file}`);
  }
  if (report.fontsStale) {
    console.log("shared/fonts.ts 与清单不一致 — 运行 node run.mjs shared fonts --write");
  }
  console.log(
    `[assets] ${report.entries} 条 / 未登记 ${report.unregistered.length} / 缺失 ${report.missing.length} / 哈希不符 ${report.badHash.length}${report.licenses.unknown.length ? ` / 许可未知 ${report.licenses.unknown.length}` : ""}`,
  );
  return exit;
}

function scan() {
  const { onDisk, added, changed, missing: removed, shadowed } = diffAssetFiles(
    entriesOf(),
    roots,
  );

  for (const item of added) console.log(`新增 ${item.path} — 未登记`);
  for (const item of changed) console.log(`变更 ${item.entry.path} — 哈希不同`);
  for (const entry of removed) console.log(`缺失 ${entry.path} — 文件不在 ${roots.map(rel).join(" / ")}`);
  for (const item of shadowed) {
    console.log(`同名 ${item.path} — 使用 ${rel(item.used)}，忽略 ${rel(item.root)}`);
  }

  if (flag("apply")) {
    for (const item of added) {
      const dir = item.path.split("/")[0];
      entriesOf().push({
        path: item.path,
        kind: KIND_BY_DIR[dir] ?? dir,
        size: item.size,
        sha256: item.sha256,
        url: null,
        license: "unknown",
        source: "user",
        provided: true,
      });
    }
    for (const item of changed) {
      item.entry.sha256 = item.sha256;
      item.entry.size = item.size;
    }
    if (flag("prune")) {
      const removedPaths = new Set(removed.map((entry) => entry.path));
      manifest.assets = entriesOf().filter((entry) => !removedPaths.has(entry.path));
    }
    let kindChanged = false;
    for (const entry of entriesOf()) {
      const dir = entry.path.split("/")[0];
      const kind = KIND_BY_DIR[dir];
      if (kind && entry.kind !== kind) {
        entry.kind = kind;
        kindChanged = true;
      }
    }
    const metaChanged = ensureFontMeta(manifest);
    const shouldWrite =
      manifestExists || added.length > 0 || changed.length > 0 || metaChanged || kindChanged;
    if (shouldWrite) {
      mkdirSync(path.dirname(manifestFile), { recursive: true });
      manifest.generatedAt = new Date().toISOString();
      writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(
        `[assets] 已写回 ${rel(manifestFile)}：新增 ${added.length} / 更新 ${changed.length} / 移除 ${flag("prune") ? removed.length : 0}`,
      );
      const fonts = writeFontsTs(cfg, manifest, { write: true });
      if (fonts.written) {
        console.log(`[assets] 字体清单已更新：${rel(fonts.file)}（${fonts.entries} 条）`);
      }
      const creditsFile = writeCreditsFile();
      console.log(`[assets] CREDITS 已更新：${rel(creditsFile)}`);
    } else {
      console.log("[assets] 素材根为空，未生成清单");
    }
  }

  console.log(
    `[assets] 清单 ${entriesOf().length} 条 / 磁盘 ${onDisk.size} 个文件 / 新增 ${added.length} / 变更 ${changed.length} / 缺失 ${flag("apply") && flag("prune") ? 0 : removed.length} / 同名 ${shadowed.length}`,
  );
  if (flag("check") && !flag("apply") && (added.length || changed.length)) return 1;
  return 0;
}

async function download(entry) {
  if (!entry.url) return false;
  if (findAssetFile(roots, entry.path) && !flag("force")) {
    console.log(`跳过（已存在）${entry.path}`);
    return true;
  }
  const file = path.join(primaryRoot, ...entry.path.split("/"));
  mkdirSync(path.dirname(file), { recursive: true });
  console.log(`下载 ${entry.path} <- ${entry.url}`);
  const response = await fetchWithRetry(entry.url);
  if (!response.ok) {
    console.error(`下载失败 ${entry.path}：HTTP ${response.status}`);
    return false;
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (entry.sha256) {
    const digest = sha256(data);
    if (digest !== entry.sha256) {
      console.error(
        `校验失败 ${entry.path}：sha256 不符（清单 ${entry.sha256.slice(0, 12)}…，下载 ${digest.slice(0, 12)}…）`,
      );
      return false;
    }
  }
  writeFileSync(file, data);
  return true;
}

function copyFrom(entry, fromRoot) {
  const source = path.join(fromRoot, ...entry.path.split("/"));
  if (findAssetFile(roots, entry.path) && !flag("force")) {
    console.log(`跳过（已存在）${entry.path}`);
    return true;
  }
  if (!existsSync(source)) {
    console.error(`源目录缺少 ${entry.path}（${source}）`);
    return false;
  }
  const file = path.join(primaryRoot, ...entry.path.split("/"));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, readFileSync(source));
  console.log(`复制 ${entry.path} <- ${source}`);
  return true;
}

async function fetchAssets() {
  if (!manifestExists) {
    console.log(
      "[assets] 没有内容包清单：把素材放进素材根后运行 node tools/assets.mjs scan --apply 生成清单；已有清单时可用 --from <dir> 部署",
    );
    return 0;
  }
  const fromRoot = value("from") ? path.resolve(value("from")) : null;
  let failed = 0;
  for (const entry of entriesOf()) {
    if (fromRoot) {
      if (!copyFrom(entry, fromRoot)) failed += 1;
      continue;
    }
    if (entry.url) {
      if (!(await download(entry))) failed += 1;
      continue;
    }
    if (!findAssetFile(roots, entry.path)) {
      console.error(`需要用户提供 ${entry.path} — 用 --from <dir> 复制`);
      failed += 1;
    }
  }
  if (!fromRoot) {
    console.log("没有可下载来源的条目，用 --from <dir> 提供素材");
  }
  return check(false) || failed;
}

if (command === "list") {
  if (!manifestExists) process.exit(unregisteredMessage());
  for (const entry of entriesOf()) {
    console.log(
      `${entry.path}\t${entry.kind}\t${entry.url ? "auto" : "user"}\t${entry.license}`,
    );
  }
  process.exit(0);
}

const code =
  command === "init"
    ? init()
    : command === "add"
      ? await add()
      : command === "remove"
        ? removeAsset(argv[1])
      : command === "audio"
        ? audioCommand(argv[1] ?? "scan")
      : command === "font"
        ? fontCommand(argv[1] ?? "list")
      : command === "fetch"
        ? await fetchAssets()
        : command === "scan"
          ? scan()
          : command === "credits"
            ? credits()
            : command === "check"
              ? check(flag("verify"))
              : (console.log(
                  "用法：node tools/assets.mjs init|add|remove|audio|font|check|scan|credits|fetch|list [--verify] [--strict] [--allow-missing] [--json] [--licenses] [--meta] [--keep-file] [--apply] [--prune] [--check] [--write] [--from <dir>] [--download] [--force] [--manifest <file>] [--kind K] [--license L] [--source S] [--name N] [--family X] [--weight N] [--style italic]",
                ), 1);

process.exit(code);
