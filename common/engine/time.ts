import { useCurrentFrame, useVideoConfig } from "remotion";

export const finite = (n: number, label = "number") => {
  if (!Number.isFinite(n)) throw new Error(`${label} must be finite`);
  return n;
};

export const positive = (n: number, label = "number") => {
  finite(n, label);
  if (n <= 0) throw new Error(`${label} must be > 0`);
  return n;
};

export const clamp01 = (n: number) => Math.min(1, Math.max(0, finite(n)));

export const smooth = (p: number) => {
  const u = clamp01(p);
  return u * u * (3 - 2 * u);
};

export const frameAt = (seconds: number, fps: number) =>
  Math.round(finite(seconds) * positive(fps, "fps"));

export const secondsAt = (frame: number, fps: number) => finite(frame) / positive(fps, "fps");

export const inRange = (t: number, start: number, end: number) => t >= start && t < end;

export const localToGlobal = (frame: number, from: number) => frame + from;

export const globalToLocal = (frame: number, from: number) => frame - from;

export const unit = (t: number, start: number, end: number) => {
  positive(end - start, "time span");
  return clamp01((t - start) / (end - start));
};

/** Quantize both absolute boundaries, never round a duration and accumulate it. */
export function frameRange(start: number, end: number, fps: number) {
  if (start < 0 || end <= start) throw new Error("invalid scene range");
  const from = frameAt(start, fps);
  const to = frameAt(end, fps);
  if (to <= from) throw new Error("range is shorter than one frame");
  return { from, to, durationInFrames: to - from };
}

export function schedule(durations: number[], overlaps: number[] = []) {
  if (!durations.length) throw new Error("empty timeline");
  if (overlaps.length && overlaps.length !== durations.length - 1) {
    throw new Error("one overlap per boundary");
  }
  const rows: { start: number; end: number }[] = [];
  durations.forEach((duration, index) => {
    positive(duration, "scene duration");
    const overlap = index ? (overlaps[index - 1] ?? 0) : 0;
    finite(overlap);
    if (overlap < 0 || (index && overlap >= Math.min(duration, durations[index - 1]))) {
      throw new Error("invalid overlap");
    }
    const start = index ? rows[index - 1].end - overlap : 0;
    rows.push({ start, end: start + duration });
    if (index > 1 && start < rows[index - 2].end) {
      throw new Error("triple overlap is unsupported");
    }
  });
  return { scenes: rows, duration: rows[rows.length - 1].end };
}

/** Local to the nearest Sequence; pass its absolute from-frame exactly once if needed. */
export function useTime(globalFromFrame = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { frame, fps, local: frame / fps, global: (frame + globalFromFrame) / fps };
}
