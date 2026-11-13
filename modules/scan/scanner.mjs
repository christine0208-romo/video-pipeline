import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  POSIX,
  readJson,
  safeName,
  shortHash,
  walkFiles,
  writeJson,
} from "../lib/fsx.mjs";
import {
  configureTools,
  detectCrop,
  ffprobe,
  orientation,
  sceneRanges,
  typeOf,
  usefulCrop,
} from "../lib/media.mjs";
import { buildThumbs } from "../lib/thumbs.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { loadHumanTags, tagAsset } from "../lib/tagger.mjs";

function thumbsOk(prev, cfg) {
  if (cfg.footage.thumbs?.enabled === false) return true;
  return (prev.thumbs ?? []).every((thumb) =>
    existsSync(path.join(cfg.paths.data, thumb)),
  );
}

export function scanAll(cfg) {
  configureTools(cfg);
  ensurePublicLinks(cfg);

  const manifestPath = path.join(cfg.paths.data, "footage.manifest.json");
  const libraryPath = path.join(cfg.paths.data, "library.json");
  const old = readJson(manifestPath, { version: 1, assets: {} });
  const oldAssets = old.assets ?? {};
  const now = new Date().toISOString();
  const next = { version: 1, scannedAt: now, roots: [], assets: {} };
  const stats = {
    roots: 0,
    files: 0,
    new: 0,
    changed: 0,
    unchanged: 0,
    missing: 0,
    processed: 0,
    scenes: 0,
    errors: 0,
    intentionalEmpty: false,
  };
  const missingRoots = [];
  let processed = 0;

  for (const link of cfg.footageLinks) {
    if (link.missing) {
      missingRoots.push(link.root);
      console.warn(`[scan] 根目录不存在，按空库处理：${link.root}`);
      continue;
    }
    stats.roots += 1;
    next.roots.push({ name: link.name, root: link.root });
    const files = walkFiles(link.root, {
      extensions: cfg.footage.extensions,
      exclude: cfg.footage.exclude,
    });
    stats.files += files.length;

    for (const file of files) {
      const type = typeOf(file);
      if (!type) continue;
      const stat = statSync(file);
      const relPath = POSIX(path.relative(link.root, file));
      const key = `${link.name}/${relPath}`;
      const prev = oldAssets[key];
      const unchanged =
        prev &&
        prev.size === stat.size &&
        Math.abs((prev.mtimeMs ?? 0) - stat.mtimeMs) < 1;

      if (unchanged && !cfg.flags.force && thumbsOk(prev, cfg)) {
        const human = loadHumanTags({
          file,
          root: link.root,
          relPath,
          id: prev.id,
          cfg,
        });
        const tags = tagAsset({
          relPath,
          scenes: prev.scenes ?? [],
          orientation: prev.orientation,
          human,
        });
        next.assets[key] = {
          ...prev,
          tags,
          status: "active",
          lastSeen: now,
        };
        stats.unchanged += 1;
        continue;
      }

      if (cfg.limit && processed >= cfg.limit) {
        if (prev) {
          next.assets[key] = { ...prev, lastSeen: now };
          stats.unchanged += 1;
        }
        continue;
      }
      processed += 1;
      stats.processed += 1;

      try {
        const meta = ffprobe(file);
        const crop =
          cfg.footage.cropDetect && type === "video"
            ? usefulCrop(detectCrop(file), meta)
            : null;
        const width = crop?.w ?? meta.width;
        const height = crop?.h ?? meta.height;
        const orient = orientation(width, height);
        const scenes =
          type === "video"
            ? sceneRanges(file, meta.duration, cfg.footage.sceneSplit)
            : [];
        const id = safeName(file, shortHash(key));
        const human = loadHumanTags({
          file,
          root: link.root,
          relPath,
          id,
          cfg,
        });
        const tags = tagAsset({ relPath, scenes, orientation: orient, human });
        const { thumbs, sheet } = buildThumbs({
          file,
          id,
          type,
          duration: meta.duration,
          crop,
          cfg,
        });

        next.assets[key] = {
          id,
          key,
          rootName: link.name,
          root: link.root,
          relPath,
          source: POSIX(file),
          publicSrc: `footage/${link.name}/${relPath}`,
          type,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          duration: Number(meta.duration.toFixed(3)),
          width: meta.width,
          height: meta.height,
          fps: Number(meta.fps.toFixed(2)),
          hasAudio: meta.hasAudio,
          orientation: orient,
          crop,
          effectiveWidth: width,
          effectiveHeight: height,
          scenes,
          thumbs,
          sheet,
          tags,
          status: "active",
          firstSeen: prev?.firstSeen ?? now,
          lastSeen: now,
          changedAt: now,
        };
        stats.scenes += scenes.length;
        if (prev) stats.changed += 1;
        else stats.new += 1;
        const label = prev ? "~" : "+";
        console.log(
          `[scan] ${label} ${type.padEnd(5)} ${relPath} (${meta.duration.toFixed(1)}s, ${scenes.length} 镜头)`,
        );
      } catch (error) {
        stats.errors += 1;
        if (prev) {
          next.assets[key] = { ...prev, status: "active", lastSeen: now };
        }
        console.warn(`[scan] 跳过 ${relPath}：${error.message}`);
      }
    }
  }

  for (const [key, prev] of Object.entries(oldAssets)) {
    if (!next.assets[key]) {
      stats.missing += 1;
      console.warn(`[scan] - 未观测 ${key}`);
    }
  }

  if (next.roots.length === 0) {
    stats.intentionalEmpty = true;
    next.missingRoots = missingRoots;
    console.log("[scan] 没有可用素材根目录，生成空素材库（intentionalEmpty）");
  } else if (missingRoots.length) {
    next.missingRoots = missingRoots;
  }

  writeJson(manifestPath, next);
  const assets = Object.values(next.assets)
    .filter((asset) => asset.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(libraryPath, { version: 1, generatedAt: now, assets });

  console.log(
    `[scan] 根目录 ${stats.roots} / 文件 ${stats.files} / 新增 ${stats.new} / 变更 ${stats.changed} / 未变 ${stats.unchanged} / 缺失 ${stats.missing} / 新增场景 ${stats.scenes}`,
  );
  console.log(`[scan] 素材库 -> ${path.relative(cfg.paths.repo, libraryPath)}`);
  return { stats, manifestPath, libraryPath };
}
