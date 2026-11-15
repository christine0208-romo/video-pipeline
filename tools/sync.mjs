#!/usr/bin/env node
/**
 * 内容包同步：扫描 creative/ 与素材根（assets.roots），报告或登记变化。
 *   node run.mjs sync                 # 报告，不写文件
 *   node run.mjs sync --apply         # 重写注册表 + 登记新素材
 *   node run.mjs sync --check         # 只检查；有差异退出 1
 *   node run.mjs sync --apply --footage  # 顺带扫描实拍
 *
 * 空核心（无 creative/、无素材）时全部通过。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";
import { scanAssetFiles } from "../modules/lib/assets.mjs";
import {
  listEnginePackages,
  registryStatus,
  writeRegistry,
} from "../modules/creative/registry.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const apply = flag("apply");
const check = flag("check");
const footage = flag("footage");
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

if (apply && check) {
  console.error("[sync] --apply 与 --check 互斥");
  process.exit(1);
}

const cfg = loadConfig(argv);
let differences = 0;

const countCreatives = (root) => {
  if (!existsSync(root)) return 0;
  return readdirSync(root, { withFileTypes: true }).filter(
    (entry) =>
      entry.isDirectory() && existsSync(path.join(root, entry.name, "creative.json")),
  ).length;
};

// 1. 引擎注册表
const engines = listEnginePackages(cfg);
const status = registryStatus(cfg);
if (status.ok) {
  console.log(`[sync] 注册表最新：${engines.length} 个引擎`);
} else {
  differences += 1;
  if (apply) {
    const file = writeRegistry(cfg);
    console.log(`[sync] 注册表已重写：${rel(file)}（${engines.length} 个引擎）`);
  } else {
    console.log(`[sync] ${status.reason}（${engines.length} 个引擎）`);
  }
}
console.log(`[sync] 创意工程 ${countCreatives(cfg.paths.creative)} 个`);

// 2. 素材清单
const manifest = path.join(cfg.paths.shared, "assets.manifest.json");
if (existsSync(manifest)) {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "tools", "assets.mjs"), "scan", apply ? "--apply" : "--check"],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (result.status !== 0) differences += 1;
} else {
  const { found } = scanAssetFiles(cfg.assetRoots);
  if (!found.size) {
    console.log("[sync] 无内容包素材清单，素材根为空");
  } else if (apply) {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "tools", "assets.mjs"), "scan", "--apply"],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (result.status !== 0) differences += 1;
  } else {
    differences += 1;
    console.log(
      `[sync] 素材根有 ${found.size} 个文件但缺少清单；运行 node run.mjs sync --apply 或 node tools/assets.mjs scan --apply`,
    );
  }
}

// 3. 实拍
if (footage) {
  if (!apply) {
    console.log("[sync] --footage 需要配合 --apply，本次跳过实拍扫描");
  } else {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, "run.mjs"), "scan"],
      { cwd: ROOT, stdio: "inherit" },
    );
    if (result.status !== 0) differences += 1;
  }
}

console.log(
  differences
    ? `[sync] 有 ${differences} 处差异${apply ? "，已写入" : "；确认后运行 node run.mjs sync --apply"}`
    : "[sync] 无差异",
);
if (check && differences) process.exit(1);
