#!/usr/bin/env node
/**
 * 环境体检：新会话开工前先跑。
 *   npm run doctor
 *
 * 只读检查，不创建、不修改、不渲染。
 */
import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";
import { findAssetFile } from "../modules/lib/assets.mjs";
import { findBrowser } from "../modules/lib/render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const warnings = [];
const ok = (message) => console.log(`✓ ${message}`);
const bad = (message) => {
  problems.push(message);
  console.error(`✗ ${message}`);
};
const warn = (message) => {
  warnings.push(message);
  console.warn(`! ${message}`);
};

const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node}，需要 >= 22`);

for (const pkg of [
  "remotion",
  "@remotion/cli",
  "@remotion/paths",
  "react",
  "react-dom",
  "lucide-react",
]) {
  const file = path.join(ROOT, "node_modules", ...pkg.split("/"), "package.json");
  if (!existsSync(file)) bad(`依赖未安装：${pkg}（先 npm install）`);
}
if (!problems.some((item) => item.startsWith("依赖未安装"))) {
  ok("运行依赖已安装");
}

let cfg = null;
try {
  cfg = loadConfig([]);
  ok(`配置可读：${path.relative(ROOT, cfg.configPath)}`);
} catch (error) {
  bad(`配置读取失败：${error.message}`);
}

if (cfg) {
  for (const root of cfg.footage.roots) {
    if (existsSync(root)) ok(`素材根目录存在：${root}`);
    else warn(`素材根目录不存在：${root}（改 config/pipeline.json 的 footage.roots）`);
  }

  for (const [name, bin] of [
    ["ffmpeg", cfg.tools.ffmpeg],
    ["ffprobe", cfg.tools.ffprobe],
  ]) {
    const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
    if (result.status === 0) ok(`${name} 可用：${bin}`);
    else bad(`${name} 不可用：${bin}（改 tools.${name} 或设 ${name.toUpperCase()}_PATH）`);
  }

  const decoders = spawnSync(
    cfg.tools.ffmpeg,
    ["-hide_banner", "-decoders"],
    { encoding: "utf8" },
  );
  const decoderList = `${decoders.stdout ?? ""}${decoders.stderr ?? ""}`;
  if (decoders.status === 0 && /libvpx-vp9/.test(decoderList)) {
    ok("ffmpeg 支持 libvpx-vp9（透明 WebM alpha 分析）");
  } else {
    warn("ffmpeg 缺少 libvpx-vp9，透明 WebM 的 alpha 覆盖率分析会失败");
  }
}

const browser = findBrowser();
if (browser) ok(`浏览器：${browser}`);
else warn("未找到 Chrome / headless shell；设 REMOTION_BROWSER 或安装 Chrome");

for (const file of ["common/vendor/fy-LICENSE.md"]) {
  if (existsSync(path.join(ROOT, file))) ok(file);
  else bad(`缺少资源：${file}`);
}

const manifestFile = path.join(ROOT, "creative", "shared", "assets.manifest.json");
if (!existsSync(manifestFile)) {
  warn("没有内容包素材清单（creative/shared/assets.manifest.json）；空核心可直接渲染");
} else if (cfg) {
  const roots = cfg.assetRoots.map((root) => path.relative(ROOT, root).split(path.sep).join("/"));
  for (const root of cfg.assetRoots) {
    if (existsSync(root)) ok(`素材根：${path.relative(ROOT, root).split(path.sep).join("/")}`);
    else warn(`素材根不存在：${path.relative(ROOT, root).split(path.sep).join("/")}（改 config/pipeline.json 或 config/local.json 的 assets.roots）`);
  }
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const entries = manifest.assets ?? [];
  const seen = new Set();
  const samples = [];
  for (const entry of entries) {
    const dir = entry.path.split("/")[0];
    if (seen.has(dir)) continue;
    seen.add(dir);
    samples.push(entry);
    if (samples.length >= 5) break;
  }
  const missing = samples.filter((entry) => !findAssetFile(cfg.assetRoots, entry.path));
  if (!entries.length) {
    ok("素材清单为空");
  } else if (missing.length) {
    warn(
      `素材未部署：抽查 ${samples.length} 项缺 ${missing.length} 项；运行 npm run assets:fetch 或 node tools/assets.mjs fetch --from <dir>（素材根：${roots.join(" / ")}）`,
    );
  } else {
    ok(`素材已部署（清单 ${entries.length} 条，抽查 ${samples.length} 项）`);
  }
}

for (const link of ["public/assets", "public/generated", "public/thumbs", "public/music"]) {
  const full = path.join(ROOT, link);
  if (!existsSync(full)) {
    warn(`${link} 尚未建立（首次 scan / generate 会建立）`);
    continue;
  }
  try {
    if (lstatSync(full).isSymbolicLink()) {
      const target = readlinkSync(full);
      ok(`${link} -> ${target}`);
    } else if (link === "public/assets") {
      const entries = readdirSync(full, { withFileTypes: true });
      const linked = entries.filter((entry) => entry.isSymbolicLink()).length;
      if (entries.length) {
        ok(`${link}：${entries.length} 个顶层项（${linked} 个整目录链接）`);
      } else {
        warn(`${link} 为空（素材根未部署）`);
      }
    } else {
      warn(`${link} 不是链接，可能是旧拷贝；删除后重跑 scan`);
    }
  } catch (error) {
    warn(`${link} 检查失败：${error.message}`);
  }
}

const footageLink = path.join(ROOT, "public", "footage");
if (!existsSync(footageLink)) {
  warn("public/footage 尚未建立（首次 scan 会建立）");
} else {
  const entries = readdirSync(footageLink, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory() || entry.isSymbolicLink(),
  );
  const linked = entries.filter((entry) => entry.isSymbolicLink()).length;
  const copied = entries.length - linked;
  if (copied) warn(`public/footage：${linked} 个链接，${copied} 个实体目录；缺失素材根恢复后运行 node run.mjs public --apply`);
  else ok(`public/footage：${linked} 个素材根链接`);
}

try {
  accessSync(ROOT, constants.W_OK);
  ok("工作区可写");
} catch {
  bad("工作区不可写");
}

if (existsSync(path.join(ROOT, "data", "library.json"))) {
  try {
    const library = JSON.parse(readFileSync(path.join(ROOT, "data", "library.json"), "utf8"));
    ok(`素材库：${library.assets?.length ?? 0} 条`);
  } catch {
    warn("data/library.json 无法解析，建议重新 scan");
  }
}
if (existsSync(path.join(ROOT, "data", "catalog.json"))) {
  try {
    const catalog = JSON.parse(readFileSync(path.join(ROOT, "data", "catalog.json"), "utf8"));
    const assets = catalog.assets ?? [];
    const missing = assets.filter((asset) => !existsSync(asset.fileMp4));
    ok(`生成素材目录：${assets.length} 条`);
    if (missing.length) {
      warn(`目录里有 ${missing.length} 条素材缺少 MP4，重跑 generate 补齐`);
    }
  } catch {
    warn("data/catalog.json 无法解析，建议重新 generate");
  }
}

console.log("");
if (problems.length) {
  console.error(`体检失败：${problems.length} 个问题，${warnings.length} 个警告。`);
  process.exit(1);
}
console.log(`体检通过：${warnings.length} 个警告。`);
console.log("下一步：node run.mjs scan  →  node run.mjs creative build  →  node run.mjs quality  →  node run.mjs mix");
