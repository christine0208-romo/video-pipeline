#!/usr/bin/env node
/**
 * 工作区体检。失败以非零码退出，适合作为提交前检查。
 *   npm run check
 *
 * 检查：
 *   1. 必需文件齐全
 *   2. src/ 确定性红线：Math.random / Date.now / new Date
 *   3. common/assets 每个文件都在 REGISTRY.json 登记
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const warnings = [];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const required = [
  "CLAUDE.md",
  "README.md",
  "STATUS.md",
  "CREDITS.md",
  "config/pipeline.json",
  "run.mjs",
  "src/index.ts",
  "src/platform.ts",
  "modules/scan/index.mjs",
  "modules/generate/index.mjs",
  "modules/mix/index.mjs",
  "tools/doctor.mjs",
  "docs/RULES.md",
  "docs/LESSONS.md",
  "docs/WORKFLOW.md",
  "docs/MODULES.md",
  "docs/DEPENDENCIES.md",
  "docs/DECISIONS.md",
  "docs/TROUBLESHOOTING.md",
  "docs/ONBOARDING.md",
  "docs/dependencies.json",
  "common/assets/REGISTRY.json",
];
for (const file of required) {
  if (!existsSync(path.join(ROOT, file))) problems.push(`缺少必需文件：${file}`);
}

// 2. 确定性红线（只扫我们自己的 src）
const deterministic = [/Math\.random\s*\(/, /Date\.now\s*\(/, /new Date\s*\(/];
for (const file of walk(path.join(ROOT, "src"))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of deterministic) {
    if (pattern.test(text)) {
      problems.push(`确定性红线：${path.relative(ROOT, file)} 出现 ${pattern}`);
    }
  }
}

// 3. 素材登记
const assetsRoot = path.join(ROOT, "common", "assets");
if (existsSync(assetsRoot)) {
  const registryFile = path.join(assetsRoot, "REGISTRY.json");
  if (!existsSync(registryFile)) {
    problems.push("缺少 common/assets/REGISTRY.json");
  } else {
    const registry = JSON.parse(readFileSync(registryFile, "utf8"));
    const registered = new Set();
    for (const entry of registry.entries ?? []) {
      for (const file of entry.files ?? []) registered.add(file);
      if (entry.glob) {
        const regex = new RegExp(
          "^" +
            entry.glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") +
            "$",
        );
        for (const file of walk(assetsRoot)) {
          const rel = path.relative(assetsRoot, file).split(path.sep).join("/");
          if (regex.test(rel)) registered.add(rel);
        }
      }
    }
    for (const file of walk(assetsRoot)) {
      const rel = path.relative(assetsRoot, file).split(path.sep).join("/");
      const base = path.basename(rel);
      if (rel === "REGISTRY.json" || base === "README.md" || base === "LICENSES.md") {
        continue;
      }
      if (!registered.has(rel)) problems.push(`素材未登记：common/assets/${rel}`);
    }
  }
} else {
  problems.push("缺少 common/assets");
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

// 5. public 链接
for (const link of ["public/assets", "public/generated", "public/thumbs", "public/music"]) {
  const full = path.join(ROOT, link);
  if (!existsSync(full)) {
    warnings.push(`${link} 尚未建立（首次 scan / generate 会建立）`);
    continue;
  }
  try {
    if (!lstatSync(full).isSymbolicLink()) {
      problems.push(`${link} 不是链接（疑似拷贝），删除后重跑 scan`);
    } else {
      readlinkSync(full);
    }
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
        problems.push(`public/footage/${entry.name} 不是链接（疑似拷贝）`);
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

if (warnings.length) {
  for (const warning of warnings) console.warn(`! ${warning}`);
}
if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`\n检查失败：${problems.length} 个问题。`);
  process.exit(1);
}
console.log("检查通过：文件、确定性、素材登记、依赖、public 链接、EDL 均无问题。");
