#!/usr/bin/env node
/**
 * 确保核心仓库在没有任何创意包时也能编译：
 *   node tools/init-creative.mjs [--force]
 *
 * 没有 creative/ 时创建一个空目录与空注册表；
 * 有创意包但缺注册表时，生成完整注册表；
 * 已有注册表时默认不动，--force 才重写。
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import { writeRegistry } from "../modules/creative/registry.mjs";

const cfg = loadConfig([]);
const root = cfg.paths.creative;
const registryFile = path.join(root, "registry.ts");
const force = process.argv.includes("--force");

mkdirSync(root, { recursive: true });

if (existsSync(registryFile) && !force) {
  console.log(`[creative] 注册表已存在：${path.relative(cfg.paths.repo, registryFile)}`);
  process.exit(0);
}

const file = writeRegistry(cfg);
console.log(`[creative] 注册表已生成：${path.relative(cfg.paths.repo, file)}`);
