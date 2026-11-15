#!/usr/bin/env node
/**
 * 素材库清单与部署：
 *   node tools/assets.mjs check [--verify] [--strict]
 *   node tools/assets.mjs scan [--apply] [--prune] [--check]
 *   node tools/assets.mjs fetch [--download] [--from <dir>] [--force]
 *   node tools/assets.mjs list
 *
 * 素材根：config/pipeline.json 的 assets.roots（可用 --asset-roots 覆盖）
 * 清单：creative/shared/assets.manifest.json（内容包；可用 --manifest 指定）
 *
 * 没有清单时视为空核心：所有命令打印“无内容包”并以 0 退出。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KIND_BY_DIR,
  diffAssetFiles,
  findAssetFile,
  sha256,
} from "../modules/lib/assets.mjs";
import { loadConfig } from "../modules/lib/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = path.join(ROOT, "creative", "shared", "assets.manifest.json");

const argv = process.argv.slice(2);
const command = argv[0]?.startsWith("-") ? "check" : (argv[0] ?? "check");
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const manifestFile = value("manifest")
  ? path.resolve(value("manifest"))
  : DEFAULT_MANIFEST;

if (!existsSync(manifestFile)) {
  console.log(`[assets] 无内容包：缺少 ${rel(manifestFile)}，跳过素材检查`);
  process.exit(0);
}

const cfg = loadConfig(argv);
const roots = cfg.assetRoots;
const primaryRoot = roots[0];
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const entriesOf = () => (manifest.assets ??= []);

function check(verify = false) {
  const missing = [];
  const badHash = [];
  const unknownLicense = [];
  for (const entry of entriesOf()) {
    if (!entry.license || entry.license === "unknown") unknownLicense.push(entry);
    const file = findAssetFile(roots, entry.path);
    if (!file) {
      missing.push(entry);
      continue;
    }
    if (verify) {
      const hash = sha256(readFileSync(file));
      if (entry.sha256 && hash !== entry.sha256) badHash.push({ entry, hash });
    }
  }
  for (const entry of missing) {
    const how = entry.url ? "可 --download" : "需用户提供（--from <dir>）";
    console.log(`缺少 ${entry.path} (${entry.kind}) — ${how}`);
  }
  for (const item of badHash) {
    console.log(`哈希不符 ${item.entry.path} — 期望 ${item.entry.sha256}，实际 ${item.hash}`);
  }
  for (const entry of unknownLicense) {
    console.log(`许可未登记 ${entry.path} — 补 license 后才能 --strict`);
  }
  console.log(
    `[assets] ${entriesOf().length} 条 / 缺失 ${missing.length} / 哈希不符 ${badHash.length} / 许可未登记 ${unknownLicense.length}`,
  );
  if (missing.length || badHash.length) return 1;
  return flag("strict") && unknownLicense.length ? 1 : 0;
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
    manifest.generatedAt = new Date().toISOString();
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `[assets] 已写回 ${rel(manifestFile)}：新增 ${added.length} / 更新 ${changed.length} / 移除 ${flag("prune") ? removed.length : 0}`,
    );
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
  const response = await fetch(entry.url, { redirect: "follow" });
  if (!response.ok) {
    console.error(`下载失败 ${entry.path}：HTTP ${response.status}`);
    return false;
  }
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
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
  for (const entry of entriesOf()) {
    console.log(
      `${entry.path}\t${entry.kind}\t${entry.url ? "auto" : "user"}\t${entry.license}`,
    );
  }
  process.exit(0);
}

const code =
  command === "fetch"
    ? await fetchAssets()
    : command === "scan"
      ? scan()
      : command === "check"
        ? check(flag("verify"))
        : (console.log(
            "用法：node tools/assets.mjs check|scan|fetch|list [--verify] [--strict] [--apply] [--prune] [--check] [--from <dir>] [--download] [--force] [--manifest <file>]",
          ), 1);

process.exit(code);
