import { spawnSync } from "node:child_process";

export const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm"]);
export const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"]);
export const AUDIO_EXT = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]);

let FFMPEG = "ffmpeg";
let FFPROBE = "ffprobe";

export function configureTools(cfg) {
  FFMPEG = cfg?.tools?.ffmpeg || process.env.FFMPEG_PATH || "ffmpeg";
  FFPROBE = cfg?.tools?.ffprobe || process.env.FFPROBE_PATH || "ffprobe";
}

export function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? (result.error ? 1 : 0),
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

export function run(cmd, args) {
  const result = runCapture(cmd, args);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} 失败：\n${result.stderr.slice(-1600)}`);
  }
  return result.stdout;
}

export function ffprobe(file) {
  const out = run(FFPROBE, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(out);
  const video = (data.streams ?? []).find((s) => s.codec_type === "video");
  const audio = (data.streams ?? []).find((s) => s.codec_type === "audio");
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  const [num, den] = String(video?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    fps: den ? num / den : 0,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    codec: video?.codec_name ?? audio?.codec_name ?? "",
  };
}

export function detectCrop(file, at = 1) {
  const result = runCapture(FFMPEG, [
    "-hide_banner",
    "-ss",
    String(at),
    "-i",
    file,
    "-vf",
    "cropdetect=24:2:0",
    "-frames:v",
    "60",
    "-f",
    "null",
    "-",
  ]);
  const matches = [...result.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if (!matches.length) return null;
  const [, w, h, x, y] = matches[matches.length - 1].map(Number);
  return { w, h, x, y };
}

export function usefulCrop(crop, meta) {
  if (!crop) return null;
  const area = crop.w * crop.h;
  const full = Math.max(1, meta.width * meta.height);
  if (crop.w < 240 || crop.h < 240) return null;
  if (area > full * 0.96) return null;
  if (area < full * 0.12) return null;
  return crop;
}

const round3 = (value) => Math.round(value * 1000) / 1000;

function singleRange(duration) {
  const safe = Math.max(0, duration);
  return [{ start: 0, end: round3(safe), bestIn: round3(Math.min(0.35, safe * 0.2)) }];
}

/** 用 ffmpeg scene 检测切镜头；失败时退化为整条素材。 */
export function sceneRanges(file, duration, { threshold = 0.32, minShot = 1.2, pad = 0.15 } = {}) {
  if (!(duration >= 1.5) || threshold <= 0) return singleRange(duration);
  const filter = `select=gt(scene\\,${threshold}),showinfo`;
  const result = runCapture(FFMPEG, [
    "-hide_banner",
    "-nostdin",
    "-i",
    file,
    "-an",
    "-filter:v",
    filter,
    "-f",
    "null",
    "-",
  ]);
  if (result.error || result.status !== 0) return singleRange(duration);

  const times = [...result.stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)]
    .map((m) => Number(m[1]))
    .filter((t) => Number.isFinite(t) && t > 0.2 && t < duration - 0.2);
  const cuts = [...new Set(times)].sort((a, b) => a - b).slice(0, 200);
  if (!cuts.length) return singleRange(duration);

  const points = [0, ...cuts, duration];
  const raw = [];
  let start = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i] - start >= minShot) {
      raw.push([start, points[i]]);
      start = points[i];
    }
  }
  if (duration - start > 0.4) raw.push([start, duration]);
  else if (raw.length) raw[raw.length - 1][1] = duration;

  return raw.map(([from, to]) => {
    const length = to - from;
    const s = Math.max(0, Math.min(from + pad, to - 0.3));
    const e = Math.max(s + 0.5, Math.min(duration, to - pad));
    return {
      start: round3(s),
      end: round3(e),
      bestIn: round3(Math.max(s, from + Math.min(0.35, length * 0.2))),
    };
  });
}

export function makeThumb(src, at, out, { crop, width = 480 } = {}) {
  const filters = [];
  if (crop) filters.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`);
  filters.push(`scale=${width}:-2`);
  const result = runCapture(FFMPEG, [
    "-y",
    "-v",
    "error",
    "-ss",
    Math.max(0, at).toFixed(3),
    "-i",
    src,
    "-frames:v",
    "1",
    "-vf",
    filters.join(","),
    "-q:v",
    "4",
    out,
  ]);
  return result.status === 0;
}

export function makeSheet(files, out) {
  if (files.length < 2) return false;
  const args = ["-y", "-v", "error"];
  for (const file of files) args.push("-i", file);
  const scaled = files.map(
    (_, i) =>
      `[${i}:v]scale=360:360:force_original_aspect_ratio=decrease,pad=360:360:(ow-iw)/2:(oh-ih)/2:black[v${i}]`,
  );
  const stack = `${files.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${files.length}[out]`;
  args.push("-filter_complex", [...scaled, stack].join(";"), "-map", "[out]", out);
  return runCapture(FFMPEG, args).status === 0;
}

export function orientation(width, height) {
  if (!width || !height) return "unknown";
  const ratio = width / height;
  if (ratio > 1.2) return "horizontal";
  if (ratio < 0.83) return "vertical";
  return "square";
}

export function typeOf(file) {
  const ext = `.${file.split(".").pop()?.toLowerCase() ?? ""}`;
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  return null;
}
