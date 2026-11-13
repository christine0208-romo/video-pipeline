#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";
import { ensureDir } from "../modules/lib/fsx.mjs";
import { linkDir, rootSlug } from "../modules/lib/public.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig(process.argv.slice(2));
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const migrationDir = path.join(cfg.paths.data, "migrations");

function inventory(dir) {
  if (!existsSync(dir)) return { exists: false, files: 0, bytes: 0 };
  const stat = lstatSync(dir);
  if (!stat.isDirectory()) return { exists: true, files: 1, bytes: stat.size };
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const child = inventory(full);
      files += child.files;
      bytes += child.bytes;
    } else {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { exists: true, files, bytes };
}

function targetOf(link) {
  try {
    return path.resolve(path.dirname(link), readlinkSync(link));
  } catch {
    return null;
  }
}

function sameTarget(link, target) {
  return targetOf(link) === path.resolve(target);
}

function uniqueBackup(link) {
  let backup = `${link}.backup-${timestamp}`;
  let index = 2;
  while (existsSync(backup)) backup = `${link}.backup-${timestamp}-${index++}`;
  return backup;
}

const projections = [
  [path.join(cfg.paths.repo, "common", "assets"), path.join(cfg.paths.public, "assets")],
  [path.join(cfg.paths.out, "assets"), path.join(cfg.paths.public, "generated")],
  [path.join(cfg.paths.data, "thumbs"), path.join(cfg.paths.public, "thumbs")],
  [path.join(cfg.paths.repo, "common", "assets", "music"), path.join(cfg.paths.public, "music")],
  ...cfg.footage.roots.map((root, index) => [root, path.join(cfg.paths.public, "footage", rootSlug(root, index))]),
];

const report = [];
for (const [target, link] of projections) {
  const source = inventory(target);
  const item = { target, link, source, status: "unknown" };
  if (!source.exists) {
    item.status = "missing-source";
    report.push(item);
    console.log(`[public] 源不存在，跳过：${target}`);
    continue;
  }
  if (!existsSync(link)) {
    if (!apply) {
      item.status = "would-create";
      console.log(`[public] 将创建链接：${link} -> ${target}`);
    } else {
      ensureDir(path.dirname(link));
      linkDir(target, link);
      item.status = "created";
      console.log(`[public] 已创建链接：${link} -> ${target}`);
    }
    report.push(item);
    continue;
  }
  const stat = lstatSync(link);
  if (stat.isSymbolicLink()) {
    item.currentTarget = targetOf(link);
    item.status = sameTarget(link, target) ? "ok" : "conflict-link";
    console.log(`[public] ${item.status}：${link}${item.currentTarget ? ` -> ${item.currentTarget}` : ""}`);
    report.push(item);
    continue;
  }

  const existing = inventory(link);
  item.existing = existing;
  const identical = existing.files === source.files && existing.bytes === source.bytes;
  if (existing.files === 0) {
    if (!apply) {
      item.status = "would-quarantine-empty";
      console.log(`[public] 空实体目录；加 --apply 才会备份并替换：${link}`);
      report.push(item);
      continue;
    }
    const backup = uniqueBackup(link);
    renameSync(link, backup);
    linkDir(target, link);
    item.backup = backup;
    item.status = "quarantined-empty-and-linked";
    console.log(`[public] 已备份空目录 ${link} -> ${backup}，并创建链接到 ${target}`);
    report.push(item);
    continue;
  }
  if (!identical) {
    item.status = "conflict-directory";
    console.log(`[public] 拒绝实体目录冲突：${link}（当前 ${existing.files} 文件/${existing.bytes} bytes，源 ${source.files} 文件/${source.bytes} bytes）`);
    report.push(item);
    continue;
  }
  if (!apply || !force) {
    item.status = "would-quarantine-identical";
    console.log(`[public] 内容规模一致；加 --apply --force 才会备份并替换：${link}`);
    report.push(item);
    continue;
  }
  const backup = uniqueBackup(link);
  renameSync(link, backup);
  linkDir(target, link);
  item.backup = backup;
  item.status = "quarantined-and-linked";
  console.log(`[public] 已备份 ${link} -> ${backup}，并创建链接到 ${target}`);
  report.push(item);
}

if (apply) {
  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(
    path.join(migrationDir, `public-${timestamp}.json`),
    `${JSON.stringify({ createdAt: new Date().toISOString(), apply, force, report }, null, 2)}\n`,
  );
}

const conflicts = report.filter((item) => item.status.startsWith("conflict"));
if (conflicts.length) process.exitCode = 1;
if (!apply) console.log("[public] 这是报告模式；确认内容后使用 --apply，实体目录还需 --force 才会隔离替换。");
