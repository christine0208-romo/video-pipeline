/**
 * 轻量视觉指标：用 ffmpeg 抽原始帧，在 JS 里算 pHash / 颜色 / 运动 / alpha 覆盖率。
 * 不引入图像解码依赖；只处理小尺寸帧（32×32 级别）。
 */
import { spawnSync } from "node:child_process";
import { configureTools } from "./media.mjs";

let FFMPEG = "ffmpeg";

const DCT_CACHE = new Map();

function ffmpegBin() {
  return FFMPEG;
}

export function useTools(cfg) {
  configureTools(cfg);
  FFMPEG = cfg?.tools?.ffmpeg || process.env.FFMPEG_PATH || "ffmpeg";
}

function decodeRaw(args) {
  const result = spawnSync(ffmpegBin(), args, {
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? "");
    throw new Error(`ffmpeg 抽帧失败：${stderr.slice(-600)}`);
  }
  return Buffer.isBuffer(result.stdout)
    ? result.stdout
    : Buffer.from(result.stdout ?? "");
}

function sampleRate(duration, frames) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 3;
  return Math.max(1, Math.min(12, frames / safeDuration));
}

function frameHeight(width, entry) {
  const w = Number(entry?.width) || 1080;
  const h = Number(entry?.height) || 1920;
  return Math.max(2, Math.min(96, Math.round((width * h) / Math.max(1, w))));
}

/** 抽取 RGB 帧；返回小尺寸帧数组。 */
export function sampleRgb(
  file,
  {
    width = 32,
    frames = 8,
    duration = 3,
    entry = null,
    at = null,
    frame = null,
  } = {},
) {
  const height = frameHeight(width, entry);
  const fps = sampleRate(duration, frames).toFixed(3);
  const args = ["-v", "error", "-nostdin", "-i", file, "-an"];
  let filter;
  if (frame != null) {
    filter = `select=eq(n\\,${Math.max(0, Math.round(frame))}),scale=${width}:${height}:flags=area,format=rgb24`;
  } else if (at != null) {
    args.push("-ss", String(Math.max(0, at)));
    filter = `scale=${width}:${height}:flags=area,format=rgb24`;
  } else {
    filter = `fps=${fps},scale=${width}:${height}:flags=area,format=rgb24`;
  }
  args.push("-vf", filter);
  if (at != null || frame != null) args.push("-frames:v", "1");
  args.push("-f", "rawvideo", "-pix_fmt", "rgb24", "-");
  const raw = decodeRaw(args);
  const frameBytes = width * height * 3;
  const count = Math.floor(raw.length / frameBytes);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(raw.subarray(i * frameBytes, (i + 1) * frameBytes));
  }
  return { frames: out, width, height };
}

/** 抽取 alpha 平面；用于透明 WebM。 */
export function sampleAlpha(
  file,
  {
    width = 32,
    frames = 8,
    duration = 3,
    entry = null,
    at = null,
    frame = null,
  } = {},
) {
  const height = frameHeight(width, entry);
  const fps = sampleRate(duration, frames).toFixed(3);
  const decoder = /\.webm$/i.test(file) ? ["-c:v", "libvpx-vp9"] : [];
  const args = [
    "-v",
    "error",
    "-nostdin",
    ...decoder,
    "-i",
    file,
    "-an",
  ];
  let filter;
  if (frame != null) {
    filter = `select=eq(n\\,${Math.max(0, Math.round(frame))}),alphaextract,scale=${width}:${height}:flags=area,format=gray`;
  } else if (at != null) {
    args.push("-ss", String(Math.max(0, at)));
    filter = `alphaextract,scale=${width}:${height}:flags=area,format=gray`;
  } else {
    filter = `fps=${fps},alphaextract,scale=${width}:${height}:flags=area,format=gray`;
  }
  args.push("-vf", filter);
  if (at != null || frame != null) args.push("-frames:v", "1");
  args.push("-f", "rawvideo", "-pix_fmt", "gray", "-");
  const raw = decodeRaw(args);
  const frameBytes = width * height;
  const count = Math.floor(raw.length / frameBytes);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(raw.subarray(i * frameBytes, (i + 1) * frameBytes));
  }
  return { frames: out, width, height };
}

export function lumaFromRgb(rgb, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const j = i * 3;
    out[i] = 0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2];
  }
  return out;
}

function cosineTable(n) {
  if (DCT_CACHE.has(n)) return DCT_CACHE.get(n);
  const table = new Float64Array(n * n);
  const scale = new Float64Array(n);
  for (let u = 0; u < n; u += 1) {
    scale[u] = u === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n);
    for (let x = 0; x < n; x += 1) {
      table[u * n + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
    }
  }
  const result = { table, scale };
  DCT_CACHE.set(n, result);
  return result;
}

/** 2D DCT-II，返回 n×n 系数（行优先）。 */
export function dct2d(gray, n) {
  const { table, scale } = cosineTable(n);
  const temp = new Float64Array(n * n);
  const out = new Float64Array(n * n);

  for (let y = 0; y < n; y += 1) {
    const row = y * n;
    for (let u = 0; u < n; u += 1) {
      let sum = 0;
      const tu = u * n;
      for (let x = 0; x < n; x += 1) sum += gray[row + x] * table[tu + x];
      temp[row + u] = sum;
    }
  }
  for (let v = 0; v < n; v += 1) {
    const tv = v * n;
    for (let u = 0; u < n; u += 1) {
      let sum = 0;
      for (let y = 0; y < n; y += 1) sum += temp[y * n + u] * table[tv + y];
      out[v * n + u] = sum * scale[v] * scale[u];
    }
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function bitsToHex(bits) {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += Number.parseInt(bits.slice(i, i + 4).padEnd(4, "0"), 2).toString(16);
  }
  return hex;
}

/** 32×32 灰度 → 8×8 低频 DCT → 64 位 pHash（hex）。 */
export function phashFromGray(gray, size = 32) {
  const coeffs = dct2d(gray, size);
  const low = [];
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) low.push(coeffs[v * size + u]);
  }
  const medianValue = median(low.slice(1));
  let bits = "0";
  for (let i = 1; i < low.length; i += 1) {
    bits += low[i] > medianValue ? "1" : "0";
  }
  return bitsToHex(bits);
}

export function majorityHash(hashes) {
  if (!hashes.length) return null;
  if (hashes.length === 1) return hashes[0];
  const counts = new Uint16Array(256);
  for (const hash of hashes) {
    for (let i = 0; i < hash.length; i += 1) {
      counts[i * 16 + Number.parseInt(hash[i], 16)] += 1;
    }
  }
  let hex = "";
  for (let i = 0; i < 16; i += 1) {
    let best = 0;
    let bestCount = -1;
    for (let v = 0; v < 16; v += 1) {
      const count = counts[i * 16 + v];
      if (count > bestCount) {
        bestCount = count;
        best = v;
      }
    }
    hex += best.toString(16);
  }
  return hex;
}

const POPCOUNT = Array.from({ length: 16 }, (_, i) =>
  ((i >> 3) & 1) + ((i >> 2) & 1) + ((i >> 1) & 1) + (i & 1),
);

export function hammingHex(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    distance += POPCOUNT[Number.parseInt(a[i], 16) ^ Number.parseInt(b[i], 16)];
  }
  return distance;
}

export function minHamming(aFrames, bFrames) {
  if (!aFrames?.length || !bFrames?.length) return 64;
  let best = 64;
  for (const a of aFrames) {
    for (const b of bFrames) {
      const d = hammingHex(a, b);
      if (d < best) best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

/** 帧间平均绝对差（0–1）。 */
export function motionEnergy(lumas) {
  if (lumas.length < 2) return 0;
  let total = 0;
  let count = 0;
  for (let i = 1; i < lumas.length; i += 1) {
    const a = lumas[i - 1];
    const b = lumas[i];
    let sum = 0;
    for (let j = 0; j < a.length; j += 1) sum += Math.abs(a[j] - b[j]);
    total += sum / a.length;
    count += 1;
  }
  return count ? total / count / 255 : 0;
}

export function colorStats(frames, width, height) {
  let r = 0;
  let g = 0;
  let b = 0;
  let graySum = 0;
  let graySq = 0;
  let pixels = 0;
  for (const frame of frames) {
    for (let i = 0; i < width * height; i += 1) {
      const j = i * 3;
      const rr = frame[j];
      const gg = frame[j + 1];
      const bb = frame[j + 2];
      r += rr;
      g += gg;
      b += bb;
      const y = 0.299 * rr + 0.587 * gg + 0.114 * bb;
      graySum += y;
      graySq += y * y;
      pixels += 1;
    }
  }
  if (!pixels) return { avgColor: [0, 0, 0], brightness: 0, contrast: 0 };
  const mean = graySum / pixels;
  const variance = Math.max(0, graySq / pixels - mean * mean);
  return {
    avgColor: [
      Math.round(r / pixels),
      Math.round(g / pixels),
      Math.round(b / pixels),
    ],
    brightness: mean / 255,
    contrast: Math.sqrt(variance) / 128,
  };
}

export function colorDistance(a, b) {
  if (!a || !b) return 1;
  const dr = (a[0] - b[0]) / 255;
  const dg = (a[1] - b[1]) / 255;
  const db = (a[2] - b[2]) / 255;
  return Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / 1.732);
}

/** alpha 覆盖率：alpha > 阈值 的像素比例，取各帧平均。 */
export function alphaCoverage(frames, threshold = 16) {
  if (!frames.length) return 0;
  let total = 0;
  for (const frame of frames) {
    let visible = 0;
    for (let i = 0; i < frame.length; i += 1) {
      if (frame[i] > threshold) visible += 1;
    }
    total += visible / frame.length;
  }
  return total / frames.length;
}
