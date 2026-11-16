import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
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

/** 素材根的建议一级目录；`kind` 由它推断。 */
export const ASSET_SUBDIRS = ["fonts", "icons", "music", "sfx", "brand", "map"];

export function ensureAssetDirs(roots) {
  const created = [];
  for (const root of roots) {
    for (const name of ASSET_SUBDIRS) {
      const dir = path.join(root, name);
      if (existsSync(dir)) continue;
      mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }
  return created;
}

export function renderCredits(entries, { extras = [] } = {}) {
  const groups = new Map();
  for (const entry of entries) {
    const kind = entry.kind ?? "other";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(entry);
  }
  const lines = [
    "# CREDITS · 公共资源",
    "",
    "> 由 `node run.mjs shared credits --write` 从 `assets.manifest.json` 生成。",
    "> 补许可 / 来源请改清单条目后重新生成，不要只改本文件。",
    "",
  ];
  for (const kind of [...groups.keys()].sort()) {
    lines.push(`## ${kind}`, "", "| 文件 | 许可 | 来源 |", "|---|---|---|");
    for (const entry of groups.get(kind)) {
      const license =
        entry.license && entry.license !== "unknown" ? entry.license : "—";
      lines.push(`| \`${entry.path}\` | ${license} | ${entry.source || "—"} |`);
    }
    lines.push("");
  }
  if (extras.length) lines.push(...extras, "");
  return lines.join("\n");
}

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

export function normalizeAssetPath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^assets\//, "");
}

/**
 * 音频索引的 file 相对素材根（`music/x.mp3`、`custom/intro.wav`），
 * 旧版裸文件名（`ui-tap.wav`）继续按 `<kind>/<name>` 兼容。
 * 返回 { file: 绝对路径, relative: 命中相对路径, src: "assets/<relative>" } 或 null。
 */
export function resolveAudioFile(roots, kind, relative) {
  const clean = normalizeAssetPath(relative);
  if (!clean) return null;
  const candidates = clean.includes("/")
    ? [clean, `${kind}/${clean}`]
    : [`${kind}/${clean}`, clean];
  for (const candidate of candidates) {
    const file = findAssetFile(roots, candidate);
    if (file) return { file, relative: candidate, src: `assets/${candidate}` };
  }
  return null;
}
