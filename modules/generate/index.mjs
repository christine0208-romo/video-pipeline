#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { readJson } from "../lib/fsx.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { renderStill, renderVideo } from "../lib/render.mjs";
import { buildCatalog, writeCatalog } from "./catalog.mjs";

function stillFrames(entry) {
  return [
    Math.max(0, Math.round(entry.durationInFrames * 0.3)),
    Math.max(0, Math.round(entry.durationInFrames * 0.75)),
  ];
}

function renderAsset(cfg, entry, { force, dryRun }) {
  const stillDir = path.join(cfg.paths.out, "stills", "assets");
  mkdirSync(stillDir, { recursive: true });
  mkdirSync(path.join(cfg.paths.out, "assets"), { recursive: true });

  const targets = [];
  if (force || !existsSync(entry.fileMp4)) {
    targets.push({
      file: entry.fileMp4,
      args: {
        composition: "PipelineAsset",
        out: entry.fileMp4,
        props: entry.propsMp4File,
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 19,
        muted: true,
      },
    });
  }
  if (entry.fileWebm && (force || !existsSync(entry.fileWebm))) {
    targets.push({
      file: entry.fileWebm,
      args: {
        composition: "PipelineAsset",
        out: entry.fileWebm,
        props: entry.propsWebmFile,
        codec: "vp9",
        pixelFormat: "yuva420p",
        imageFormat: "png",
        muted: true,
      },
    });
  }

  if (dryRun) {
    console.log(
      `[generate] dry-run ${entry.id} -> ${targets.length ? targets.map((t) => path.basename(t.file)).join(", ") : "已存在"}`,
    );
    return 0;
  }

  for (const target of targets) {
    renderVideo(target.args);
  }

  for (const frame of stillFrames(entry)) {
    const still = path.join(stillDir, `${entry.id}-${frame}.png`);
    if (force || !existsSync(still)) {
      renderStill({
        composition: "PipelineAsset",
        frame,
        out: still,
        props: entry.propsMp4File,
      });
    }
  }
  return targets.length;
}

try {
  const cfg = loadConfig(process.argv.slice(2));
  ensurePublicLinks(cfg);
  const entries = buildCatalog(cfg);
  const existing = readJson(
    path.join(cfg.paths.data, "catalog.json"),
    null,
  );
  const kept = (existing?.assets ?? []).filter(
    (entry) =>
      !cfg.generate.presets.includes(entry.preset) &&
      !entries.some((next) => next.id === entry.id),
  );
  const catalog = [...kept, ...entries];
  const catalogFile = writeCatalog(cfg, catalog);
  const force = Boolean(cfg.flags.force);
  const dryRun = Boolean(cfg.flags["dry-run"]);

  let rendered = 0;
  let failed = 0;
  for (const entry of entries) {
    try {
      const count = renderAsset(cfg, entry, { force, dryRun });
      rendered += count;
      const files = [
        existsSync(entry.fileMp4) || count ? "mp4" : null,
        entry.fileWebm && (existsSync(entry.fileWebm) || count) ? "webm" : null,
      ]
        .filter(Boolean)
        .join("+");
      console.log(
        `[generate] ${entry.id} (${entry.preset}, ${entry.duration}s${entry.alpha ? ", alpha" : ""}) ${dryRun ? "dry-run" : files || "cached"}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[generate] 失败 ${entry.id}：${error.message}`);
    }
  }

  console.log(
    `[generate] ${entries.length} 条本次素材 / 目录共 ${catalog.length} 条 / 本次渲染 ${rendered} 个文件 / 失败 ${failed} / 目录 ${path.relative(cfg.paths.repo, path.dirname(catalogFile))}`,
  );
  if (failed) process.exit(1);
  console.log("[generate] 下一步：node run.mjs mix");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
