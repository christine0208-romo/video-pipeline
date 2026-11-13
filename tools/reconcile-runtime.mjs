#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import { addToRegistry } from "../modules/mix/uniqueness.mjs";

const cfg = loadConfig(process.argv.slice(2));
const action = cfg.positionals[0] ?? "list";
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

function sizeOf(target) {
  if (!existsSync(target)) return { files: 0, bytes: 0 };
  const stat = lstatSync(target);
  if (!stat.isDirectory()) return { files: 1, bytes: stat.size };
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const child = sizeOf(path.join(target, entry.name));
    files += child.files;
    bytes += child.bytes;
  }
  return { files, bytes };
}

const publicDir = cfg.paths.public;
const staticBackups = existsSync(publicDir)
  ? readdirSync(publicDir)
      .filter((name) => name.includes(".backup-"))
      .map((name) => path.join(publicDir, name))
  : [];

const targets = [
  ["cache", cfg.paths.cache],
  ["temp", cfg.paths.temp],
  ["out-checks", path.join(cfg.paths.out, "checks")],
  ["out-downloads", path.join(cfg.paths.out, "downloads")],
  ...staticBackups.map((file) => ["public-backup", file]),
];

const rows = targets.map(([name, target]) => ({ name, target, ...sizeOf(target) }));

function invalidEdls() {
  const edlDir = path.join(cfg.paths.data, "edl");
  if (!existsSync(edlDir)) return { invalid: [], valid: [] };
  const library = new Set(
    (requireJson(path.join(cfg.paths.data, "library.json"))?.assets ?? []).map((a) => a.id),
  );
  const catalog = new Set(
    (requireJson(path.join(cfg.paths.data, "catalog.json"))?.assets ?? []).map((a) => a.id),
  );
  const invalid = [];
  const valid = [];
  for (const name of readdirSync(edlDir)) {
    if (!name.endsWith(".json") || name.endsWith(".props.json") || name === "signatures.json") continue;
    const id = name.slice(0, -5);
    const edl = requireJson(path.join(edlDir, name));
    if (!edl) continue;
    const shots = (edl.beats ?? []).flatMap((beat) => beat.shots ?? []);
    const reasons = [];
    for (const shot of shots) {
      if (shot.kind === "footage" && !library.has(shot.assetId)) reasons.push(`missing-footage:${shot.assetId}`);
      if (shot.kind === "generated" && !catalog.has(shot.assetId)) reasons.push(`missing-generated:${shot.assetId}`);
      for (const id2 of [shot.overlay?.assetId, shot.transitionAsset?.assetId]) {
        if (id2 && !catalog.has(id2)) reasons.push(`missing-generated:${id2}`);
      }
    }
    if (reasons.length) invalid.push({ id, reasons: [...new Set(reasons)] });
    else valid.push(id);
  }
  return { invalid, valid };
}

function requireJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

if (action === "prune-edl") {
  const { invalid, valid } = invalidEdls();
  for (const item of invalid) {
    console.log(`[runtime] 无效 EDL ${item.id}：${item.reasons.slice(0, 4).join(", ")}${item.reasons.length > 4 ? " ..." : ""}`);
    if (!apply) continue;
    const edlDir = path.join(cfg.paths.data, "edl");
    for (const file of [`${item.id}.json`, `${item.id}.props.json`]) rmSync(path.join(edlDir, file), { force: true });
    rmSync(path.join(cfg.paths.out, `${item.id}.mp4`), { force: true });
    rmSync(path.join(cfg.paths.out, "segments", item.id), { recursive: true, force: true });
    rmSync(path.join(cfg.paths.out, "stills", item.id), { recursive: true, force: true });
  }
  console.log(`[runtime] 有效 EDL ${valid.length} / 无效 EDL ${invalid.length}`);
  if (apply) {
    const registry = { version: 1, signatures: {}, ranges: {}, generated: {}, outputs: {} };
    const edlDir = path.join(cfg.paths.data, "edl");
    for (const id of valid) {
      const edl = requireJson(path.join(edlDir, `${id}.json`));
      if (edl) addToRegistry(registry, edl);
    }
    mkdirSync(edlDir, { recursive: true });
    writeFileSync(
      path.join(edlDir, "signatures.json"),
      `${JSON.stringify(registry, null, 2)}\n`,
    );
    console.log(`[runtime] 已重建签名库：${Object.keys(registry.outputs).length} 条成片记录`);
  }
  if (!apply) console.log("[runtime] dry-run；加 --apply 删除无效 EDL 及其成片/分段/静帧。");
  process.exit(0);
}

if (action === "list") {
  for (const row of rows) {
    console.log(`[runtime] ${row.name}\t${row.files} files\t${row.bytes} bytes\t${row.target}`);
  }
  process.exit(0);
}
if (action !== "clean") {
  console.error("用法：node run.mjs runtime list|clean [--apply] [--force]");
  process.exit(2);
}

for (const row of rows) {
  if (!row.files) continue;
  if (!apply) {
    console.log(`[runtime] 将清理 ${row.name}: ${row.files} files / ${row.bytes} bytes`);
    continue;
  }
  const quarantine = path.join(cfg.paths.cache, "quarantine", `${row.name}-${stamp}`);
  mkdirSync(path.dirname(quarantine), { recursive: true });
  renameSync(row.target, quarantine);
  console.log(`[runtime] 已隔离 ${row.name} -> ${quarantine}`);
  if (force) {
    rmSync(quarantine, { recursive: true, force: true });
    console.log(`[runtime] 已删除隔离副本 ${quarantine}`);
  }
}

const staleFootage = path.join(publicDir, "footage");
if (existsSync(staleFootage)) {
  for (const entry of readdirSync(staleFootage, { withFileTypes: true })) {
    const full = path.join(staleFootage, entry.name);
    if (entry.isSymbolicLink()) continue;
    const info = sizeOf(full);
    const message = `public/footage/${entry.name} 是实体目录（${info.files} files / ${info.bytes} bytes），不是有效投影`;
    if (!apply) {
      console.log(`[runtime] ${message}；将隔离`);
      continue;
    }
    if (info.files > 0 && !force) {
      console.log(`[runtime] 跳过非空实体目录（需 --force）：${full}`);
      continue;
    }
    const quarantine = path.join(cfg.paths.cache, "quarantine", `footage-${entry.name}-${stamp}`);
    mkdirSync(path.dirname(quarantine), { recursive: true });
    renameSync(full, quarantine);
    console.log(`[runtime] 已隔离 ${full} -> ${quarantine}`);
    if (force) rmSync(quarantine, { recursive: true, force: true });
  }
}

if (!apply) console.log("[runtime] dry-run；加 --apply 执行隔离，再加 --force 删除隔离副本。");
