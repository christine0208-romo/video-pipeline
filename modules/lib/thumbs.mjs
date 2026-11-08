import { existsSync } from "node:fs";
import path from "node:path";
import { ensureDir } from "./fsx.mjs";
import { makeSheet, makeThumb } from "./media.mjs";

export function buildThumbs({ file, id, type, duration, crop, cfg }) {
  if (type === "audio" || cfg.footage.thumbs?.enabled === false) {
    return { thumbs: [], sheet: null };
  }
  const dir = path.join(cfg.paths.data, "thumbs");
  ensureDir(dir);
  const count =
    type === "image" ? 1 : Math.max(1, Number(cfg.footage.thumbs?.count ?? 3));
  const width = Number(cfg.footage.thumbs?.width ?? 480);
  const fractions =
    count === 3
      ? [0.15, 0.5, 0.85]
      : Array.from({ length: count }, (_, i) => (i + 0.5) / count);

  const thumbs = [];
  for (let i = 0; i < count; i += 1) {
    const rel = `thumbs/${id}-${i + 1}.jpg`;
    const abs = path.join(cfg.paths.data, rel);
    if (!existsSync(abs)) {
      const at =
        type === "image"
          ? 0
          : Math.max(0, Math.min(duration - 0.05, duration * fractions[i]));
      if (!makeThumb(file, at, abs, { crop, width })) continue;
    }
    thumbs.push(rel);
  }

  let sheet = thumbs[0] ?? null;
  if (thumbs.length > 1) {
    const rel = `thumbs/${id}-sheet.jpg`;
    const abs = path.join(cfg.paths.data, rel);
    if (!existsSync(abs)) {
      makeSheet(
        thumbs.map((thumb) => path.join(cfg.paths.data, thumb)),
        abs,
      );
    }
    if (existsSync(abs)) sheet = rel;
  }
  return { thumbs, sheet };
}
