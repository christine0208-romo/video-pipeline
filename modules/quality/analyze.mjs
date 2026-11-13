import { existsSync } from "node:fs";
import {
  alphaCoverage,
  colorStats,
  hammingHex,
  lumaFromRgb,
  majorityHash,
  motionEnergy,
  phashFromGray,
  sampleAlpha,
  sampleRgb,
  useTools,
} from "../lib/vision.mjs";

export const QUALITY_VERSION = 8;

export const QUALITY_DEFAULTS = {
  autoAnalyze: true,
  sampleFrames: 8,
  phashSize: 32,
  alphaSampleWidth: 96,
  alphaThreshold: 4,
  minAlphaCoverage: 0.001,
  faintAlphaCoverage: 0.01,
  minMotionEnergy: 0.00002,
  minContrast: 0.008,
  loopDistance: 12,
  settleMotion: 0.004,
  clearAlpha: 0.02,
  clusterDistance: 12,
  similarityThreshold: 0.86,
  maxSimilarityPairs: 24,
};

export function qualityConfig(cfg) {
  return { ...QUALITY_DEFAULTS, ...(cfg?.quality ?? {}) };
}

function categoryOf(entry) {
  if (entry.category) return entry.category;
  const recipe = entry.recipeId ?? "";
  if (recipe.startsWith("text-")) return "text";
  if (recipe.startsWith("transition-")) return "transition";
  if (recipe.startsWith("particle-")) return "particle";
  if (recipe.startsWith("camera-")) return "camera";
  if (entry.preset === "ui-mock") return "ui";
  if (entry.preset === "kinetic-grid") return "graphic";
  if (entry.preset) return "icon";
  return entry.layer ?? "scene";
}

function frameDiff(a, b) {
  if (!a || !b) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length / 255;
}

function flagsFor(entry, quality, options) {
  const flags = [];
  const category = categoryOf(entry);
  if (entry.overlayCapable || entry.alpha) {
    if (quality.alphaCoverage == null) {
      flags.push("alpha-unknown");
    } else if (quality.alphaCoverage < options.minAlphaCoverage) {
      flags.push("empty-alpha");
    } else if (quality.alphaCoverage < options.faintAlphaCoverage) {
      flags.push("faint-alpha");
    }
  }
  if (quality.motionEnergy < options.minMotionEnergy) flags.push("static");
  if (quality.contrast < options.minContrast && quality.brightness < 0.02) {
    flags.push("blank");
  }
  if (entry.loop && quality.firstLastHamming > options.loopDistance) {
    flags.push("loop-mismatch");
  }
  const endPolicy = entry.complete ?? (category === "text" ? "hold" : null);
  if (
    endPolicy === "hold" &&
    !entry.loop &&
    quality.endMotion > options.settleMotion
  ) {
    flags.push("end-unsettled");
  }
  if (
    entry.complete === "clear" &&
    category === "transition" &&
    quality.alphaEnd != null &&
    quality.alphaEnd > options.clearAlpha
  ) {
    flags.push("end-residue");
  }
  return flags;
}

/** 分析单条生成素材；文件不存在返回 null。 */
export function analyzeAsset(cfg, entry, { force = false } = {}) {
  const options = qualityConfig(cfg);
  if (
    !force &&
    entry.quality?.version === QUALITY_VERSION &&
    entry.quality?.phash
  ) {
    return entry.quality;
  }
  if (!entry.fileMp4 || !existsSync(entry.fileMp4)) return null;

  const duration = Math.max(0.2, Number(entry.duration) || 3);
  const fps = Number(entry.fps) || 30;
  const frames = Math.max(
    2,
    Math.min(options.sampleFrames, Math.round(duration * fps)),
  );

  const sampled = sampleRgb(entry.fileMp4, {
    width: options.phashSize,
    frames,
    duration,
    entry,
  });
  const lumas = sampled.frames.map((frame) =>
    lumaFromRgb(frame, sampled.width, sampled.height),
  );
  const hashes = lumas.map((luma) => phashFromGray(luma, options.phashSize));
  const color = colorStats(sampled.frames, sampled.width, sampled.height);
  const lastIndex = Math.max(0, lumas.length - 1);
  const lastFrame = Math.max(
    0,
    Number(entry.durationInFrames ?? Math.round(duration * fps)) - 1,
  );
  let lastHash = hashes[lastIndex];
  let firstHash = hashes[0];
  let tailLuma = null;
  try {
    const first = sampleRgb(entry.fileMp4, {
      width: options.phashSize,
      frames: 1,
      duration,
      entry,
      frame: 0,
    });
    if (first.frames.length) {
      firstHash = phashFromGray(
        lumaFromRgb(first.frames[0], first.width, first.height),
        options.phashSize,
      );
    }
  } catch {
    /* fall back to first sampled frame */
  }
  try {
    const tail = sampleRgb(entry.fileMp4, {
      width: options.phashSize,
      frames: 1,
      duration,
      entry,
      frame: lastFrame,
    });
    if (tail.frames.length) {
      tailLuma = lumaFromRgb(tail.frames[0], tail.width, tail.height);
      lastHash = phashFromGray(tailLuma, options.phashSize);
    }
  } catch {
    /* fall back to last sampled frame */
  }
  const firstLastHamming = hashes.length
    ? hammingHex(firstHash, lastHash)
    : 0;
  let endMotion =
    lumas.length > 1 ? frameDiff(lumas[lastIndex - 1], lumas[lastIndex]) : 0;
  if (tailLuma) {
    try {
      const before = sampleRgb(entry.fileMp4, {
        width: options.phashSize,
        frames: 1,
        duration,
        entry,
        frame: Math.max(0, lastFrame - 1),
      });
      if (before.frames.length) {
        endMotion = frameDiff(
          lumaFromRgb(before.frames[0], before.width, before.height),
          tailLuma,
        );
      }
    } catch {
      /* keep sampled end motion */
    }
  }

  let coverage = 1;
  let alphaEnd = null;
  if (entry.alpha && entry.fileWebm && existsSync(entry.fileWebm)) {
    try {
      const alpha = sampleAlpha(entry.fileWebm, {
        width: options.alphaSampleWidth,
        frames: Math.min(frames, 6),
        duration,
        entry,
      });
      coverage = alphaCoverage(alpha.frames, options.alphaThreshold);
      const tailAlpha = sampleAlpha(entry.fileWebm, {
        width: options.alphaSampleWidth,
        frames: 1,
        duration,
        entry,
        frame: lastFrame,
      });
      alphaEnd = alphaCoverage(tailAlpha.frames, options.alphaThreshold);
    } catch {
      coverage = null;
      alphaEnd = null;
    }
  }

  const quality = {
    version: QUALITY_VERSION,
    category: categoryOf(entry),
    sampleFrames: hashes.length,
    phash: majorityHash(hashes),
    phashFrames: hashes,
    firstLastHamming,
    endMotion: Number(endMotion.toFixed(5)),
    alphaCoverage: coverage == null ? null : Number(coverage.toFixed(4)),
    alphaEnd: alphaEnd == null ? null : Number(alphaEnd.toFixed(4)),
    motionEnergy: Number(motionEnergy(lumas).toFixed(5)),
    brightness: Number(color.brightness.toFixed(4)),
    contrast: Number(color.contrast.toFixed(4)),
    avgColor: color.avgColor,
    flags: [],
    ok: true,
    analyzedAt: new Date().toISOString(),
  };
  quality.flags = flagsFor(entry, quality, options);
  quality.ok = !quality.flags.some(
    (flag) => flag === "empty-alpha" || flag === "blank" || flag === "loop-mismatch",
  );
  return quality;
}

/** 依次分析素材，把结果写回 entry.quality；返回统计。 */
export function analyzeEntries(
  cfg,
  entries,
  { force = false, logPrefix = "[quality]", onProgress = null } = {},
) {
  useTools(cfg);
  const options = qualityConfig(cfg);
  const targets = entries.filter(
    (entry) =>
      entry.fileMp4 &&
      existsSync(entry.fileMp4) &&
      (force || entry.quality?.version !== QUALITY_VERSION || !entry.quality?.phash),
  );
  let analyzed = 0;
  let failed = 0;
  let flagged = 0;
  for (const entry of targets) {
    try {
      const quality = analyzeAsset(cfg, entry, { force });
      if (!quality) continue;
      entry.quality = quality;
      analyzed += 1;
      if (quality.flags.length) {
        flagged += 1;
        console.warn(
          `${logPrefix} ! ${entry.id} ${quality.flags.join(",")} (alpha=${quality.alphaCoverage}, motion=${quality.motionEnergy})`,
        );
      }
      if (onProgress) onProgress(entry, quality, analyzed, targets.length);
    } catch (error) {
      failed += 1;
      console.warn(`${logPrefix} 分析失败 ${entry.id}：${error.message}`);
    }
  }
  return {
    targets: targets.length,
    analyzed,
    failed,
    flagged,
    skipped: entries.length - targets.length,
    options,
  };
}
