import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  readdirSync,
  readlinkSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { ensureDir, slugify } from "./fsx.mjs";

function sameTarget(link, target) {
  try {
    const current = readlinkSync(link);
    return path.resolve(path.dirname(link), current) === path.resolve(target);
  } catch {
    return false;
  }
}

function linkExists(link) {
  try {
    lstatSync(link);
    return true;
  } catch {
    return false;
  }
}

export function linkDir(target, link) {
  ensureDir(target);
  if (linkExists(link)) {
    if (sameTarget(link, target)) return;
    let dangling = false;
    try {
      dangling = lstatSync(link).isSymbolicLink() && !existsSync(link);
    } catch {
      dangling = false;
    }
    if (dangling) unlinkSync(link);
    else {
      throw new Error(
        `public 链接冲突：${link} 已存在且不指向 ${target}。请手动检查后再运行。`,
      );
    }
  }
  symlinkSync(
    path.resolve(target),
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
}

export function rootSlug(root, index) {
  const base = path
    .basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || `root-${index + 1}`;
}

/**
 * public/ 是渲染时的静态根：
 *   assets/    -> 素材根合并（config.assets.roots；字体、图标、地图、音乐）
 *   footage/   -> 每个素材根目录一个 junction，按原相对路径读取
 *   generated/ -> out/assets（模块二产物）
 *   thumbs/    -> data/thumbs（静帧/海报）
 *   music/     -> 第一个含 music/ 的素材根
 */
/**
 * 素材根按配置顺序合并到 public/assets：同一相对路径由前一个根优先。
 * 同名单目录只有一份时直接 junction；多份时递归合并；文件用硬链接（失败复制）。
 */
function removeTree(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) unlinkSync(full);
    else if (entry.isDirectory()) removeTree(full);
    else unlinkSync(full);
  }
  rmdirSync(dir);
}

function claimEntries(roots) {
  const claim = new Map();
  for (const root of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const kind = entry.isDirectory() ? "dir" : "file";
      const full = path.join(root, entry.name);
      const existing = claim.get(entry.name);
      if (!existing) {
        claim.set(entry.name, { kind, paths: [full] });
      } else if (existing.kind !== kind) {
        console.warn(`[public] ${entry.name} 在不同素材根里类型不一致，使用 ${existing.paths[0]}`);
      } else {
        existing.paths.push(full);
      }
    }
  }
  return claim;
}

function mergeAssetDir(roots, dest) {
  const claim = claimEntries(roots);
  ensureDir(dest);
  for (const [name, item] of claim) {
    const target = path.join(dest, name);
    if (item.kind === "file") {
      try {
        linkSync(item.paths[0], target);
      } catch {
        copyFileSync(item.paths[0], target);
      }
    } else if (item.paths.length === 1) {
      symlinkSync(
        path.resolve(item.paths[0]),
        target,
        process.platform === "win32" ? "junction" : "dir",
      );
    } else {
      mergeAssetDir(item.paths, target);
    }
  }
}

function linkAssetRoots(cfg, publicDir) {
  const roots = (cfg.assetRoots ?? []).filter((root) => existsSync(root));
  const dest = path.join(publicDir, "assets");
  if (!roots.length) {
    console.warn("[public] 素材未部署：跳过 public/assets（先运行 npm run assets:fetch）");
    return;
  }
  if (linkExists(dest)) {
    if (lstatSync(dest).isSymbolicLink()) unlinkSync(dest);
    else removeTree(dest);
  }
  mergeAssetDir(roots, dest);
}

export function ensurePublicLinks(cfg) {
  const publicDir = cfg.paths.public;
  ensureDir(publicDir);
  ensureDir(path.join(cfg.paths.out, "assets"));
  ensureDir(path.join(cfg.paths.data, "thumbs"));

  linkAssetRoots(cfg, publicDir);
  linkDir(path.join(cfg.paths.out, "assets"), path.join(publicDir, "generated"));
  linkDir(path.join(cfg.paths.data, "thumbs"), path.join(publicDir, "thumbs"));
  const musicRoot = (cfg.assetRoots ?? [])
    .map((root) => path.join(root, "music"))
    .find((dir) => existsSync(dir));
  if (musicRoot) {
    linkDir(musicRoot, path.join(publicDir, "music"));
  } else {
    console.warn("[public] 素材根里没有 music/：跳过 public/music");
  }

  const footageDir = path.join(publicDir, "footage");
  ensureDir(footageDir);
  const previous = new Map(
    readdirSync(footageDir, { withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => [entry.name, path.join(footageDir, entry.name)]),
  );
  cfg.footageLinks = [];
  cfg.footage.roots.forEach((root, index) => {
    const base = rootSlug(root, index);
    let name = base;
    let n = 2;
    while (cfg.footageLinks.some((item) => item.name === name)) {
      name = `${base}-${n}`;
      n += 1;
    }
    if (!existsSync(root)) {
      cfg.footageLinks.push({ name, root, missing: true });
      return;
    }
    linkDir(root, path.join(footageDir, name));
    previous.delete(name);
    cfg.footageLinks.push({ name, root, missing: false });
  });
  for (const [name, link] of previous) {
    unlinkSync(link);
    console.log(`[public] 已移除失效 footage 链接：${name}`);
  }
  return cfg.footageLinks;
}

export function linkMusic(cfg, musicPath, subdir = "audio") {
  const dir = path.join(cfg.paths.public, subdir);
  ensureDir(dir);
  const name = slugify(
    path.basename(musicPath, path.extname(musicPath)),
    60,
  );
  const extension = path.extname(musicPath);
  const file = `${name}${extension}`;
  const dest = path.join(dir, file);
  try {
    const stat = lstatSync(dest);
    if (stat.isSymbolicLink()) unlinkSync(dest);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  copyFileSync(musicPath, dest);
  return `${subdir}/${file}`;
}
