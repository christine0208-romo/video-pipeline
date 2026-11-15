#!/usr/bin/env node
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { normalizeWorkId, readJson } from "../lib/fsx.mjs";
import { writeCatalog } from "../generate/catalog.mjs";
import { analyzeEntries, qualityConfig } from "./analyze.mjs";
import { buildReport, pairMetrics } from "./similarity.mjs";
import { formatReport, writeReport } from "./report.mjs";

const splitIds = (value) =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function applyOverrides(cfg) {
  cfg.quality = qualityConfig(cfg);
  if (cfg.flags["cluster-distance"]) {
    cfg.quality.clusterDistance = Number(cfg.flags["cluster-distance"]);
  }
  if (cfg.flags["similarity-threshold"]) {
    cfg.quality.similarityThreshold = Number(cfg.flags["similarity-threshold"]);
  }
  if (cfg.flags["sample-frames"]) {
    cfg.quality.sampleFrames = Number(cfg.flags["sample-frames"]);
  }
}

function filterAssets(assets, cfg) {
  let list = assets;
  if (cfg.flags.only) {
    const ids = new Set(splitIds(cfg.flags.only));
    list = list.filter((asset) => ids.has(asset.id));
  }
  if (cfg.flags.layer) {
    const layers = new Set(splitIds(cfg.flags.layer));
    list = list.filter((asset) => layers.has(asset.layer ?? "scene"));
  }
  if (cfg.flags.scope) {
    list = list.filter(
      (asset) => (asset.scope ?? "shared") === String(cfg.flags.scope),
    );
  }
  if (cfg.flags.work) {
    const workId = normalizeWorkId(cfg.flags.work);
    list = list.filter((asset) => asset.workId === workId);
  }
  return list;
}

function listAssets(assets) {
  console.log("id\tlayer\tphash\tmotion\talpha\tok\tflags");
  for (const asset of assets) {
    const q = asset.quality ?? {};
    console.log(
      `${asset.id}\t${asset.layer ?? "scene"}\t${q.phash ?? "-"}\t${
        q.motionEnergy ?? "-"
      }\t${q.alphaCoverage ?? "-"}\t${q.ok === false ? "no" : "yes"}\t${
        (q.flags ?? []).join(",") || "-"
      }`,
    );
  }
}

function edlCheck(cfg, assets) {
  const edlFile = `${cfg.flags.edl}.json`;
  const edl = readJson(
    path.join(cfg.paths.data, "edl", `${cfg.flags.edl}.json`),
    null,
  );
  if (!edl?.beats) {
    console.warn(`[quality] EDL 不存在：${edlFile}`);
    return 1;
  }
  const used = new Set();
  for (const beat of edl.beats) {
    for (const shot of beat.shots ?? []) {
      for (const id of [
        shot.assetId,
        shot.overlay?.assetId,
        shot.transitionAsset?.assetId,
      ]) {
        if (id) used.add(id);
      }
    }
  }
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const list = [...used].map((id) => byId.get(id)).filter(Boolean);
  console.log(
    `[quality] EDL ${edl.id}：引用 ${list.length} 条生成素材`,
  );
  const issues = list.filter((asset) => asset.quality?.ok === false);
  if (issues.length) {
    console.warn(
      `[quality] 其中 ${issues.length} 条质量不达标：${issues
        .map((asset) => `${asset.id}(${(asset.quality.flags ?? []).join(",")})`)
        .join(", ")}`,
    );
  }
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (!list[i].quality?.phash || !list[j].quality?.phash) continue;
      if ((list[i].layer ?? "scene") !== (list[j].layer ?? "scene")) continue;
      const metrics = pairMetrics(list[i], list[j]);
      if (metrics.score >= qualityConfig(cfg).similarityThreshold) {
        pairs.push({ a: list[i].id, b: list[j].id, ...metrics });
      }
    }
  }
  if (pairs.length) {
    console.warn(`[quality] 同一成片内 ${pairs.length} 对素材观感接近：`);
    for (const pair of pairs) {
      console.warn(
        `  ${pair.a} ~ ${pair.b}  score=${pair.score} mean=${pair.hammingMean}`,
      );
    }
  }
  return issues.length || pairs.length ? 1 : 0;
}

try {
  const cfg = loadConfig(process.argv.slice(2));
  applyOverrides(cfg);
  const catalogFile = path.join(cfg.paths.data, "catalog.json");
  const catalog = readJson(catalogFile, null);
  if (!catalog?.assets?.length) {
    throw new Error("生成素材库为空：先运行 node run.mjs creative build");
  }

  const assets = filterAssets(catalog.assets, cfg);

  if (cfg.flags["list"]) {
    listAssets(assets);
    process.exit(0);
  }

  let analysis = null;
  if (!cfg.flags["report-only"]) {
    analysis = analyzeEntries(cfg, assets, {
      force: Boolean(cfg.flags.force),
      logPrefix: "[quality]",
      onProgress: (entry, quality, done, total) => {
        if (cfg.flags.verbose) {
          console.log(
            `[quality] ${done}/${total} ${entry.id} phash=${quality.phash} motion=${quality.motionEnergy} alpha=${quality.alphaCoverage}`,
          );
        }
      },
    });
    if (analysis.analyzed) {
      writeCatalog(cfg, catalog.assets);
    }
  }

  if (cfg.flags.edl) {
    process.exit(edlCheck(cfg, assets));
  }

  const report = buildReport(cfg, assets);
  const files = cfg.flags["no-write"] ? null : writeReport(cfg, report);
  if (cfg.flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
    if (files) {
      console.log(
        `[quality] 报告 -> ${files.jsonFile} / ${files.mdFile}`,
      );
    }
  }

  const strict =
    report.summary.nearDuplicates > 0 || report.summary.flagged > 0;
  if (cfg.flags.strict && strict) {
    console.error(
      `[quality] strict 失败：${report.summary.nearDuplicates} 对近似重复 / ${report.summary.flagged} 条质量标记`,
    );
    process.exit(1);
  }
  if (analysis?.failed) process.exit(1);
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
