import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SKIP_FILE = /^REGISTRY\.json$/;
const SKIP_DOC = /^(README|LICENSES)\.md$/;

export const KIND_BY_DIR = {
  fonts: "font",
  icons: "icon",
  music: "music",
  sfx: "sfx",
  brand: "brand",
  map: "map",
  shots: "shot",
};

export const sha256 = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/**
 * 与实拍库一致：多个素材根按配置顺序合并，同名相对路径由前一个根优先。
 * 返回 Map<相对路径, { size, sha256, root }> 与被遮蔽的条目。
 */
export function scanAssetFiles(roots) {
  const found = new Map();
  const shadowed = [];
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      const base = path.basename(relative);
      if (SKIP_FILE.test(base) || SKIP_DOC.test(base)) continue;
      if (found.has(relative)) {
        shadowed.push({ path: relative, root, used: found.get(relative).root });
        continue;
      }
      const buffer = readFileSync(file);
      found.set(relative, { size: buffer.length, sha256: sha256(buffer), root });
    }
  }
  return { found, shadowed };
}

export function diffAssetFiles(assets, roots) {
  const { found: onDisk, shadowed } = scanAssetFiles(roots);
  const known = new Map(assets.map((entry) => [entry.path, entry]));
  const added = [];
  const changed = [];
  const missing = [];
  for (const [relative, info] of onDisk) {
    const entry = known.get(relative);
    if (!entry) added.push({ path: relative, ...info });
    else if (entry.sha256 && entry.sha256 !== info.sha256) {
      changed.push({ entry, ...info });
    }
  }
  for (const [relative, entry] of known) {
    if (!onDisk.has(relative)) missing.push(entry);
  }
  return { onDisk, added, changed, missing, shadowed };
}

export function findAssetFile(roots, relative) {
  const clean = String(relative).replace(/\\/g, "/").replace(/^\.\//, "");
  for (const root of roots) {
    const file = path.join(root, ...clean.split("/"));
    if (existsSync(file)) return file;
  }
  return null;
}
