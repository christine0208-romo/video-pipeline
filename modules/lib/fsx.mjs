import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const POSIX = (p) => p.split(path.sep).join("/");

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function shortHash(value, length = 8) {
  return createHash("sha1").update(String(value)).digest("hex").slice(0, length);
}

export function safeName(file, hash) {
  const base = path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 26);
  return `${base || "asset"}-${hash}`;
}

export function slugify(value, max = 40) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return slug || "item";
}

export function walkFiles(root, { extensions, exclude } = {}) {
  if (!existsSync(root)) return [];
  const skip = new Set((exclude ?? []).map((x) => x.toLowerCase()));
  const allowed = extensions ? new Set(extensions.map((x) => x.toLowerCase())) : null;
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith(".") || skip.has(name.toLowerCase())) continue;
      const full = path.join(dir, name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (allowed && !allowed.has(ext)) continue;
      files.push(full);
    }
  }
  return files.sort();
}

export function pathExists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}
