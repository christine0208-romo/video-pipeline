#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig(process.argv.slice(2));
const action = cfg.positionals[0] ?? "list";
const force = process.argv.includes("--force");

const roots = [
  ["cache", cfg.paths.cache],
  ["temp", cfg.paths.temp],
  ["checks", path.join(cfg.paths.out, "checks")],
  ["downloads", path.join(cfg.paths.out, "downloads")],
];

function sizeOf(target) {
  if (!existsSync(target)) return { files: 0, bytes: 0, newest: null };
  const stat = statSync(target);
  if (!stat.isDirectory()) return { files: 1, bytes: stat.size, newest: stat.mtime.toISOString() };
  let files = 0;
  let bytes = 0;
  let newest = stat.mtime;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const child = sizeOf(path.join(target, entry.name));
    files += child.files;
    bytes += child.bytes;
    if (child.newest && new Date(child.newest) > newest) newest = new Date(child.newest);
  }
  return { files, bytes, newest: newest.toISOString() };
}

function managed(target) {
  const resolved = path.resolve(target);
  return roots.some(([, root]) => resolved === path.resolve(root) || resolved.startsWith(`${path.resolve(root)}${path.sep}`));
}

const rows = roots.map(([name, target]) => ({ name, target, ...sizeOf(target) }));
if (action === "list") {
  for (const row of rows) console.log(`[cache] ${row.name}\t${row.files} files\t${row.bytes} bytes\t${row.target}`);
  process.exit(0);
}
if (action !== "clean") {
  console.error("用法：node run.mjs cache list|clean [--force]");
  process.exit(2);
}
for (const row of rows) {
  if (!row.files) continue;
  if (!managed(row.target)) throw new Error(`拒绝清理非受管路径：${row.target}`);
  console.log(`[cache] ${force ? "清理" : "将清理"} ${row.name}: ${row.files} files / ${row.bytes} bytes`);
  if (force) rmSync(row.target, { recursive: true, force: true });
}
if (!force) console.log("[cache] dry-run；加 --force 才会删除受管 cache/temp/checks/downloads。");
