#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { ensureDir, normalizeWorkId, readJson, writeJson } from "../lib/fsx.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { renderStill, renderVideo } from "../lib/render.mjs";
import { seedFrom } from "../lib/rng.mjs";
import { isVisibleToWork, readCatalog } from "../generate/catalog.mjs";
import { planOutput, loadRegistry } from "./planner.mjs";
import { addToRegistry, removeOutputFromRegistry, validateEdl } from "./uniqueness.mjs";

function registryWithout(registry, outputId) {
  const clone = JSON.parse(JSON.stringify(registry));
  return removeOutputFromRegistry(clone, outputId);
}

function checkExisting(cfg, registry) {
  const edlDir = path.join(cfg.paths.data, "edl");
  if (!existsSync(edlDir)) {
    console.log("[mix] 还没有 EDL");
    return 0;
  }
  const files = readdirSync(edlDir).filter(
    (file) =>
      file.endsWith(".json") &&
      !file.endsWith(".props.json") &&
      file !== "signatures.json",
  );
  let failed = 0;
  for (const file of files) {
    const edl = readJson(path.join(edlDir, file));
    const result = validateEdl(edl, registryWithout(registry, edl.id), cfg);
    if (result.ok) {
      console.log(
        `[mix] ✓ ${edl.id}（${result.stats.shots} 镜头，${result.stats.footage} 实拍）${
          result.warnings.length ? `，${result.warnings.length} 条警告` : ""
        }`,
      );
      for (const warning of result.warnings) console.warn(`  ! ${warning}`);
    } else {
      failed += 1;
      console.error(`[mix] ✗ ${edl.id}`);
      for (const error of result.errors) console.error(`  - ${error}`);
    }
  }
  return failed;
}

function renderOne(cfg, edl, propsFile, { stillsOnly }) {
  const stillDir = path.join(cfg.paths.out, "stills", edl.id);
  ensureDir(stillDir);

  for (const frame of edl.stills) {
    renderStill({
      composition: "MixVideo",
      frame,
      out: path.join(stillDir, `frame-${frame}.png`),
      props: propsFile,
    });
  }
  console.log(
    `[mix] ${edl.id} 静帧 ${edl.stills.length} 张 -> ${path.relative(
      cfg.paths.repo,
      stillDir,
    )}`,
  );
  if (stillsOnly) return null;

  const total = edl.durationInFrames;
  const cuts = [0, Math.round(total / 3), Math.round(2 * total / 3), total];
  for (let i = 0; i < 3; i += 1) {
    const from = cuts[i];
    const to = cuts[i + 1];
    if (to <= from) continue;
    const segDir = path.join(
      cfg.paths.out,
      "segments",
      edl.id,
      `seg-${from}-${to}`,
    );
    ensureDir(segDir);
    renderVideo({
      composition: "MixVideo",
      out: path.join(segDir, `seg-${from}-${to}.mp4`),
      props: propsFile,
      frames: `${from}-${to - 1}`,
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 19,
    });
    const checkFrames = [
      from,
      Math.floor((from + to - 1) / 2),
      Math.max(from, to - 1),
    ];
    for (const frame of new Set(checkFrames)) {
      renderStill({
        composition: "MixVideo",
        frame,
        out: path.join(segDir, `still-${frame}.png`),
        props: propsFile,
      });
    }
    console.log(
      `[mix] ${edl.id} 分段 ${from}-${to} -> ${path.relative(cfg.paths.repo, segDir)}`,
    );
  }

  const output = path.join(cfg.paths.out, `${edl.id}.mp4`);
  renderVideo({
    composition: "MixVideo",
    out: output,
    props: propsFile,
    codec: "h264",
    pixelFormat: "yuv420p",
    crf: 19,
  });
  console.log(`[mix] ${edl.id} 成片 -> ${path.relative(cfg.paths.repo, output)}`);
  return output;
}

try {
  const cfg = loadConfig(process.argv.slice(2));
  const registry = loadRegistry(cfg);

  if (cfg.flags["check-only"]) {
    const failed = checkExisting(cfg, registry);
    process.exit(failed ? 1 : 0);
  }

  ensurePublicLinks(cfg);
  const library = readJson(path.join(cfg.paths.data, "library.json"), null);
  if (!library?.assets?.length) {
    throw new Error("素材库为空：先运行 node run.mjs scan");
  }
  const pool = library.assets.filter(
    (asset) => asset.type === "video" && Number(asset.duration) >= 1.5,
  );
  if (!pool.length) {
    throw new Error("没有可用的实拍视频：素材库里没有时长 >= 1.5s 的视频");
  }
  const activePool = pool;
  const workId = cfg.mix.work ? normalizeWorkId(cfg.mix.work) : null;
  if (workId) cfg.mix.work = workId;
  const catalogAll = readCatalog(cfg).filter((entry) =>
    existsSync(entry.fileMp4),
  );
  const catalog = workId
    ? catalogAll.filter((entry) => isVisibleToWork(entry, workId))
    : catalogAll.filter((entry) => (entry.scope ?? "shared") === "shared");
  if (!catalog.length) {
    throw new Error("生成素材为空：先运行 node run.mjs creative build");
  }
  if (workId) {
    const own = catalog.filter(
      (entry) => entry.scope === "work" && entry.workId === workId,
    ).length;
    if (!own) {
      console.log(
        `[mix] ${workId} 没有专属素材，使用 shared 素材库${cfg.mix.requireWorkAsset ? "（但 requireWorkAsset=true）" : ""}`,
      );
    }
  }
  const lowQuality = catalog.filter((entry) => entry.quality?.ok === false);
  if (lowQuality.length) {
    console.warn(
      `[mix] ${
        cfg.mix.allowLowQuality ? "允许使用" : "跳过"
      } ${lowQuality.length} 条质量不达标素材：${lowQuality
        .slice(0, 6)
        .map((entry) => `${entry.id}(${(entry.quality.flags ?? []).join(",")})`)
        .join(", ")}${lowQuality.length > 6 ? " ..." : ""}`,
    );
  }
  if (workId && !cfg.flags.seed) {
    const workEntry = catalogAll.find(
      (entry) =>
        entry.scope === "work" &&
        entry.workId === workId &&
        entry.workSeed != null,
    );
    cfg.mix.seed = workEntry ? Number(workEntry.workSeed) : seedFrom(workId);
  }

  const edlDir = path.join(cfg.paths.data, "edl");
  ensureDir(edlDir);
  const planned = [];
  const baseSeed = Number(cfg.mix.seed);
  const outputCount = workId ? 1 : Number(cfg.mix.outputs);

  for (let index = 0; index < outputCount; index += 1) {
    const outputId = workId ?? `mix-${baseSeed}-${index + 1}`;
    removeOutputFromRegistry(registry, outputId);
  }

  for (let index = 0; index < outputCount; index += 1) {
    const outputId = workId ?? `mix-${baseSeed}-${index + 1}`;
    let winner = null;
    let lastValidation = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const patched = {
        ...cfg,
        mix: {
          ...cfg.mix,
          seed: baseSeed + attempt * 104729,
          outputId,
        },
      };
      const candidate = planOutput(patched, {
        index,
        pool: activePool,
        catalog,
        registry,
      });
      const validation = validateEdl(candidate.edl, registry, cfg);
      if (
        validation.ok &&
        workId &&
        cfg.mix.requireWorkAsset &&
        (candidate.edl.stats?.ownWorkAssets ?? 0) === 0
      ) {
        validation.ok = false;
        validation.errors.push(
          `work ${workId} 未使用任何 work 素材（requireWorkAsset=true；可加 --with-assets 或关闭该要求）`,
        );
      }
      if (validation.ok) {
        winner = { ...candidate, validation };
        break;
      }
      lastValidation = validation;
      console.warn(
        `[mix] ${outputId} 第 ${attempt + 1} 次规划未通过：${validation.errors
          .slice(0, 3)
          .join("；")}`,
      );
    }

    if (!winner) {
      console.error(`[mix] ${outputId} 无法满足去重约束`);
      for (const error of lastValidation?.errors ?? []) console.error(`  - ${error}`);
      process.exit(1);
    }

    const edl = winner.edl;
    const edlFile = path.join(edlDir, `${edl.id}.json`);
    const propsFile = path.join(edlDir, `${edl.id}.props.json`);
    writeJson(edlFile, edl);
    writeJson(propsFile, { edl });
    addToRegistry(registry, edl);
    planned.push({ edl, edlFile, propsFile, validation: winner.validation });

    console.log(
      `[mix] 规划 ${edl.id}：${winner.validation.stats.shots} 镜头 / ${winner.validation.stats.footage} 实拍 / ${winner.validation.stats.generated} 生成${
        winner.validation.warnings.length
          ? ` / ${winner.validation.warnings.length} 条警告`
          : ""
      }`,
    );
    for (const warning of winner.validation.warnings) {
      console.warn(`  ! ${warning}`);
    }
  }

  if (cfg.flags["dry-run"]) {
    console.log("[mix] dry-run：EDL 已写入 data/edl，未渲染");
    process.exit(0);
  }

  for (const item of planned) {
    renderOne(cfg, item.edl, item.propsFile, {
      stillsOnly: Boolean(cfg.flags["stills-only"]),
    });
  }

  if (!cfg.flags["stills-only"]) {
    writeJson(path.join(edlDir, "signatures.json"), registry);
    console.log(
      `[mix] 完成 ${planned.length} 条成片；签名库 -> ${path.relative(
        cfg.paths.repo,
        path.join(edlDir, "signatures.json"),
      )}`,
    );
  }
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
