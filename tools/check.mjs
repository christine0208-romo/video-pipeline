#!/usr/bin/env node
/**
 * 工作区体检。失败以非零码退出，适合作为提交前检查。
 *   npm run check
 *
 * 检查：
 *   1. 必需文件齐全
 *   2. src/ 确定性红线：Math.random / Date.now / new Date
 *   3. 公共资源清单（shared/assets.manifest.json）与磁盘一致
 *   4. package.json 依赖都在 docs/dependencies.json 登记
 *   5. public 链接是链接而不是拷贝
 *   6. 已有 EDL 通过去重校验
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";
import { rootSlug } from "../modules/lib/public.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig([]);
const problems = [];
const warnings = [];

// 0. 没有创意包时也保证注册表存在（空注册表）
const creativeInit = spawnSync(
  process.execPath,
  [path.join(ROOT, "tools", "init-creative.mjs")],
  { cwd: ROOT, encoding: "utf8" },
);
if (creativeInit.status !== 0) {
  problems.push(
    `创意注册表初始化失败：\n${(creativeInit.stdout ?? "") + (creativeInit.stderr ?? "")}`,
  );
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const required = [
  "README.md",
  "config/pipeline.json",
  "config/pipeline.schema.json",
  "config/components.json",
  "config/workbench.json",
  "run.mjs",
  "src/index.ts",
  "src/platform.ts",
  "src/types.ts",
  "modules/scan/index.mjs",  "modules/creative/index.mjs",
  "modules/creative/loader.mjs",
  "modules/creative/params.mjs",
  "modules/creative/compile.mjs",
  "modules/creative/build.mjs",
  "modules/creative/work.mjs",
  "modules/creative/review.mjs",
  "tools/init-creative.mjs",
  "tools/assets.mjs",
  "tools/market.mjs",
  "tools/sync.mjs",
  "tools/projects.mjs",
  "tools/shared.mjs",
  "modules/lib/assets.mjs",
  "modules/lib/resources.mjs",
  "modules/lib/market.mjs",
  "modules/lib/projects.mjs",
  "docs/architecture/CREATIVE.md",
  "modules/quality/index.mjs",
  "modules/quality/analyze.mjs",
  "modules/quality/similarity.mjs",
  "modules/mix/index.mjs",
  "workbench/server.mjs",
  "workbench/public/index.html",
  "workbench/public/app.js",
  "workbench/public/styles.css",
  "tools/doctor.mjs",
  "tools/check-config.mjs",
  "tools/cache.mjs",
  "tools/reindex.mjs",
  "tools/reconcile-runtime.mjs",
  "tools/migrate-public.mjs",
  "docs/reference/RULES.md",
  "docs/reference/shots/INDEX.md",
  "docs/architecture/SHARED.md",
  "docs/records/LESSONS.md",
  "docs/operations/WORKFLOW.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/architecture/AUDIO.md",
  "docs/architecture/MARKET.md",
  "docs/operations/FISSION.md",
  "docs/operations/QUALITY.md",
  "docs/architecture/ASSETS.md",
  "docs/operations/WORKBENCH.md",
  "docs/operations/DEPENDENCIES.md",
  "docs/records/DECISIONS.md",
  "docs/operations/TROUBLESHOOTING.md",
  "docs/README.md",
  "docs/dependencies.json",
];
for (const file of required) {
  if (!existsSync(path.join(ROOT, file))) problems.push(`缺少必需文件：${file}`);
}

const configCheck = spawnSync(
  process.execPath,
  [path.join(ROOT, "tools", "check-config.mjs")],
  { cwd: ROOT, encoding: "utf8" },
);
if (configCheck.status !== 0) {
  problems.push(`配置检查失败：\n${(configCheck.stdout ?? "") + (configCheck.stderr ?? "")}`);
}

// 1.1 内容包同步检查（注册表过期、未登记素材）
const syncCheck = spawnSync(
  process.execPath,
  [path.join(ROOT, "tools", "sync.mjs"), "--check"],
  { cwd: ROOT, encoding: "utf8" },
);
if (syncCheck.status !== 0) {
  problems.push(`内容包未同步：\n${(syncCheck.stdout ?? "") + (syncCheck.stderr ?? "")}`);
}

// 1.2 公共资源层结构校验（存在 shared/ 时才检查）
if (existsSync(cfg.paths.shared)) {
  const sharedCheck = spawnSync(
    process.execPath,
    [path.join(ROOT, "run.mjs"), "shared", "validate"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (sharedCheck.status !== 0) {
    problems.push(`公共资源层校验失败：\n${(sharedCheck.stdout ?? "") + (sharedCheck.stderr ?? "")}`);
  }
}

// 2. 确定性红线（src 与 creative 引擎实现）
const deterministic = [/Math\.random\s*\(/, /Date\.now\s*\(/, /new Date\s*\(/];
for (const rootDir of [path.join(ROOT, "src"), path.join(ROOT, "creative")]) {
  for (const file of walk(rootDir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const pattern of deterministic) {
      if (pattern.test(text)) {
        problems.push(`确定性红线：${path.relative(ROOT, file)} 出现 ${pattern}`);
      }
    }
  }
}

// 3. 内容包素材清单（没有内容包时跳过）
const manifestFile = path.join(cfg.paths.shared, "assets.manifest.json");
if (existsSync(manifestFile)) {
  const assetsCheck = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "assets.mjs"), "check", "--verify", "--allow-missing"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (assetsCheck.status !== 0) {
    problems.push(
      `素材清单检查失败：\n${(assetsCheck.stdout ?? "") + (assetsCheck.stderr ?? "")}`,
    );
  }
}

// 4. 依赖登记
const packageFile = path.join(ROOT, "package.json");
const dependenciesFile = path.join(ROOT, "docs", "dependencies.json");
if (existsSync(packageFile) && existsSync(dependenciesFile)) {
  const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
  const registry = JSON.parse(readFileSync(dependenciesFile, "utf8"));
  const approved = registry.approved ?? {};
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const name of Object.keys(all)) {
    if (!approved[name]) problems.push(`依赖未登记：${name}（补 docs/dependencies.json）`);
  }
}

// 5. public 链接（assets 是素材根合并目录，允许为实体目录）
for (const link of ["public/assets", "public/generated", "public/thumbs", "public/music"]) {
  const full = path.join(ROOT, link);
  if (!existsSync(full)) {
    warnings.push(`${link} 尚未建立（首次 scan / generate 会建立）`);
    continue;
  }
  try {
    if (lstatSync(full).isSymbolicLink()) {
      readlinkSync(full);
      continue;
    }
    if (link !== "public/assets" || !lstatSync(full).isDirectory()) {
      problems.push(`${link} 不是链接（疑似拷贝），删除后重跑 scan`);
      continue;
    }
    const entries = readdirSync(full, { withFileTypes: true });
    if (!entries.length) warnings.push("public/assets 为空（素材根未部署）");
  } catch (error) {
    problems.push(`${link} 检查失败：${error.message}`);
  }
}

const footageLink = path.join(ROOT, "public", "footage");
if (existsSync(footageLink)) {
  if (!lstatSync(footageLink).isDirectory()) {
    problems.push("public/footage 不是目录");
  } else {
    for (const entry of readdirSync(footageLink, { withFileTypes: true })) {
      const child = path.join(footageLink, entry.name);
      if (!entry.isSymbolicLink()) {
        const index = cfg.footage.roots.findIndex((root, rootIndex) => rootSlug(root, rootIndex) === entry.name);
        if (index >= 0 && !existsSync(cfg.footage.roots[index])) {
          warnings.push(`public/footage/${entry.name} 等待缺失素材根目录恢复`);
        } else {
          problems.push(`public/footage/${entry.name} 不是链接（疑似拷贝）`);
        }
      }
    }
  }
} else {
  warnings.push("public/footage 尚未建立（首次 scan 会建立）");
}

// 6. 生成素材目录完整性
const catalogFile = path.join(ROOT, "data", "catalog.json");
if (existsSync(catalogFile)) {
  try {
    const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
    for (const asset of catalog.assets ?? []) {
      if (!existsSync(asset.fileMp4)) {
        warnings.push(`目录条目缺少 MP4：${asset.id}`);
      }
      if (asset.fileWebm && !existsSync(asset.fileWebm)) {
        warnings.push(`目录条目缺少 WebM：${asset.id}`);
      }
    }
  } catch {
    problems.push("data/catalog.json 无法解析");
  }
}

// 7. EDL 去重校验
const edlDir = path.join(ROOT, "data", "edl");
const edlFiles = existsSync(edlDir)
  ? readdirSync(edlDir).filter(
      (file) =>
        file.endsWith(".json") &&
        !file.endsWith(".props.json") &&
        file !== "signatures.json",
    )
  : [];
if (edlFiles.length) {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "modules", "mix", "index.mjs"), "--check-only"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    problems.push(`EDL 校验失败：\n${(result.stdout ?? "") + (result.stderr ?? "")}`);
  }
}

// 8. 新增核心文件闸门
const CORE_PREFIXES = ["modules/", "tools/", "src/", "common/", "workbench/", "config/"];
const isCoreFile = (file) =>
  CORE_PREFIXES.some((prefix) => file.startsWith(prefix)) || !file.includes("/");
const newFileGate = () => {
  const allow =
    process.env.ALLOW_NEW_FILES === "1" ||
    process.argv.includes("--allow-new-files");
  const status = spawnSync("git", ["status", "--porcelain=v1", "-uall"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (status.status !== 0) return;
  const added = [];
  for (const line of (status.stdout ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const index = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (!file) continue;
    if (!(index === "??" || index[0] === "A")) continue;
    if (!isCoreFile(file)) continue;
    added.push(file);
  }
  if (!added.length) return;
  if (allow) {
    warnings.push(`新增核心文件已放行（ALLOW_NEW_FILES=1）：${added.join("、")}`);
    return;
  }
  problems.push(
    `新增核心文件未确认：${added.join("、")}\n新增核心文件前先按 docs/reference/RULES.md 第 11 节给出四问；确认后运行 ALLOW_NEW_FILES=1 npm run check。`,
  );
};
newFileGate();

if (warnings.length) {
  for (const warning of warnings) console.warn(`! ${warning}`);
}
if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`\n检查失败：${problems.length} 个问题。`);
  process.exit(1);
}
console.log("检查通过：文件、确定性、素材清单、依赖、public 链接、EDL 均无问题。");
