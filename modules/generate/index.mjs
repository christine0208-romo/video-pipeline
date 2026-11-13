#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { buildCatalog, mergeCatalog, writeCatalog } from "./catalog.mjs";
import { renderAsset } from "./render.mjs";
import { reviewCatalog } from "./review.mjs";
import { analyzeEntries } from "../quality/analyze.mjs";

try {
  const cfg = loadConfig(process.argv.slice(2));
  if (
    cfg.flags.review ||
    cfg.flags.list ||
    cfg.flags.approve ||
    cfg.flags.reject ||
    cfg.flags.share ||
    cfg.flags["list-works"] ||
    cfg.flags["clean-work"]
  ) {
    process.exit(reviewCatalog(cfg));
  }
  ensurePublicLinks(cfg);
  const entries = buildCatalog(cfg);
  const dryRun = Boolean(cfg.flags["dry-run"]);
  if (dryRun) {
    console.log(
      `[generate] dry-run：本次 ${entries.length} 条候选，未重写 catalog、未渲染。`,
    );
    process.exit(0);
  }
  const { catalog, mergedEntries, catalogFile } = mergeCatalog(cfg, entries);
  const mergedById = new Map(mergedEntries.map((entry) => [entry.id, entry]));
  const force = Boolean(cfg.flags.force);

  let rendered = 0;
  let failed = 0;
  const renderedIds = new Set();
  for (const entry of entries) {
    const effective = mergedById.get(entry.id) ?? entry;
    try {
      const count = renderAsset(cfg, entry, { force, dryRun });
      rendered += count;
      if (count) renderedIds.add(entry.id);
      const files = [
        existsSync(entry.fileMp4) || count ? "mp4" : null,
        entry.fileWebm && (existsSync(entry.fileWebm) || count) ? "webm" : null,
      ]
        .filter(Boolean)
        .join("+");
      console.log(
        `[generate] ${entry.id} (${entry.preset}, ${entry.layer}, ${entry.duration}s${entry.alpha ? ", alpha" : ""}, ${effective.status}) ${dryRun ? "dry-run" : files || "cached"}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[generate] 失败 ${entry.id}：${error.message}`);
    }
  }

  let quality = null;
  if (!dryRun && cfg.quality?.autoAnalyze !== false) {
    for (const entry of catalog) {
      if (renderedIds.has(entry.id)) entry.quality = null;
    }
    const needs = catalog;
    if (needs.length) {
      quality = analyzeEntries(cfg, needs, { logPrefix: "[generate]" });
      if (quality.analyzed) writeCatalog(cfg, catalog);
    }
  }

  console.log(
    `[generate] ${entries.length} 条本次素材 / 目录共 ${catalog.length} 条 / 本次渲染 ${rendered} 个文件 / 失败 ${failed}${
      quality ? ` / 质量分析 ${quality.analyzed} 条` : ""
    } / 目录 ${path.relative(cfg.paths.repo, path.dirname(catalogFile))}`,
  );
  if (failed) process.exit(1);
  console.log("[generate] 下一步：node run.mjs mix");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
