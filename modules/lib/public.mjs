import {
  copyFileSync,
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
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
    throw new Error(
      `public 链接冲突：${link} 已存在且不指向 ${target}。请手动检查后再运行。`,
    );
  }
  symlinkSync(
    path.resolve(target),
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
}

export function linkFile(target, link) {
  if (linkExists(link)) return;
  ensureDir(path.dirname(link));
  try {
    symlinkSync(path.resolve(target), link);
  } catch {
    copyFileSync(target, link);
  }
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
 *   assets/    -> common/assets（字体、图标、地图、音乐）
 *   footage/   -> 每个素材根目录一个 junction，按原相对路径读取
 *   generated/ -> out/assets（模块二产物）
 *   thumbs/    -> data/thumbs（静帧/海报）
 *   music/     -> common/assets/music
 */
export function ensurePublicLinks(cfg) {
  const publicDir = cfg.paths.public;
  ensureDir(publicDir);
  ensureDir(path.join(cfg.paths.out, "assets"));
  ensureDir(path.join(cfg.paths.data, "thumbs"));

  linkDir(path.join(cfg.paths.repo, "common", "assets"), path.join(publicDir, "assets"));
  linkDir(path.join(cfg.paths.out, "assets"), path.join(publicDir, "generated"));
  linkDir(path.join(cfg.paths.data, "thumbs"), path.join(publicDir, "thumbs"));
  linkDir(
    path.join(cfg.paths.repo, "common", "assets", "music"),
    path.join(publicDir, "music"),
  );

  const footageDir = path.join(publicDir, "footage");
  ensureDir(footageDir);
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
    cfg.footageLinks.push({ name, root, missing: false });
  });
  return cfg.footageLinks;
}

export function linkMusic(cfg, musicPath, subdir = "audio") {
  const dir = path.join(cfg.paths.public, subdir);
  ensureDir(dir);
  const name = slugify(path.basename(musicPath), 60);
  const extension = path.extname(musicPath);
  const file = `${name}${extension}`;
  linkFile(musicPath, path.join(dir, file));
  return `${subdir}/${file}`;
}
