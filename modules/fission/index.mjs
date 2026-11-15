#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { deepMerge, PIPELINE_ROOT, loadConfig } from "../lib/config.mjs";
import { normalizeWorkId, writeJson } from "../lib/fsx.mjs";
import { seedFrom } from "../lib/rng.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { generateWorkAssets } from "../creative/work.mjs";
import { pickVariation } from "../generate/variation.mjs";

const parsePerLayer = (value, fallback) => {
  if (!value) return { ...fallback };
  const [scene, overlay, transition] = String(value).split(",").map(Number);
  return {
    scene: Number.isFinite(scene) ? scene : fallback.scene,
    overlay: Number.isFinite(overlay) ? overlay : fallback.overlay,
    transition: Number.isFinite(transition)
      ? transition
      : fallback.transition,
  };
};

try {
  const cfg = loadConfig(process.argv.slice(2));
  ensurePublicLinks(cfg);

  const force = Boolean(cfg.flags.force);
  const dryRun = Boolean(cfg.flags["dry-run"]);
  const workCount = cfg.flags.work
    ? 1
    : Number(cfg.flags.works ?? cfg.fission.works ?? 1);
  const baseSeed = Number(
    cfg.flags.seed ?? cfg.fission.seed ?? cfg.mix.seed,
  );
  const duration = Number(
    cfg.flags.duration ?? cfg.fission.duration ?? cfg.mix.duration,
  );
  const counts = parsePerLayer(
    cfg.flags["per-layer"],
    cfg.fission.assetsPerLayer,
  );
  const creativePool = cfg.creative?.pool ?? "all";
  const generateAssets = Boolean(cfg.fission.generateAssets);

  if (!generateAssets && cfg.flags["per-layer"]) {
    console.warn(
      "[fission] 当前使用 shared 素材库，--per-layer 不会生成新素材；需要专属素材请加 --with-assets。",
    );
  }

  console.log(
    `[fission] works=${workCount} seed=${baseSeed} duration=${duration}s assets=${
      generateAssets ? `work (${counts.scene}/${counts.overlay}/${counts.transition})` : "shared"
    }`,
  );

  let failed = 0;
  for (let index = 0; index < workCount; index += 1) {
    const rawWorkId = cfg.flags.work ?? `work-${baseSeed}-${index + 1}`;
    const workId = normalizeWorkId(rawWorkId);
    const workSeed = cfg.flags["work-seed"]
      ? Number(cfg.flags["work-seed"]) + index
      : seedFrom(workId);

    console.log(`\n[fission] ${workId} (seed=${workSeed})`);
    let profile;
    if (generateAssets) {
      const result = generateWorkAssets(cfg, {
        workId,
        workSeed,
        counts,
        creativePool,
        force,
        dryRun,
      });
      profile = result.profile;
      console.log(
        `[fission] ${workId}: ${result.entries.length} 条 work 素材，失败 ${result.failed}`,
      );
      if (result.failed) {
        failed += 1;
        continue;
      }
    } else {
      profile = pickVariation(workSeed, cfg);
      console.log(`[fission] ${workId}: 使用 shared 素材库，不生成 work 素材`);
    }
    console.log(
      `[fission] ${workId} profile palette=${profile.summary.palette} rhythm=${profile.summary.rhythm}` ,
    );
    if (dryRun) {
      console.log(`[fission] dry-run：跳过 ${workId} 的 mix`);
      continue;
    }

    const baseConfig = deepMerge({}, cfg);
    const workConfig = deepMerge(baseConfig, {
      mix: {
        beats: profile.rhythm.beats,
        generatedRatio: profile.rhythm.generatedRatio,
        overlayBias: profile.rhythm.overlayBias,
        ...(profile.rhythm.shotLength
          ? { shotLength: profile.rhythm.shotLength }
          : {}),
        workProfile: profile.rhythm.name,
        variation: profile.summary,
      },
    });
    const workConfigFile = path.join(
      cfg.paths.data,
      "works",
      `${workId}.config.json`,
    );
    writeJson(workConfigFile, workConfig);

    const mix = spawnSync(
      process.execPath,
      [
        path.join(PIPELINE_ROOT, "run.mjs"),
        "mix",
        "--config",
        workConfigFile,
        "--work",
        workId,
        "--seed",
        String(workSeed),
        "--duration",
        String(duration),
        "--outputs",
        "1",
      ],
      { cwd: PIPELINE_ROOT, stdio: "inherit" },
    );
    if (mix.status !== 0) {
      failed += 1;
      console.error(`[fission] ${workId} mix 失败`);
    }
  }

  if (failed) process.exit(1);
  console.log(`\n[fission] 完成 ${workCount - failed}/${workCount} 个作品`);
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
