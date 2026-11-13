import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { keyedRandom } from "../../platform";
import { paletteOf, type Palette } from "../palette";
import type { PresetProps } from "../types";
import { Backdrop } from "./backdrop";

const hash2 = (x: number, y: number, seed: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

const smoothNoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (
    hash2(xi, yi, seed) * (1 - u) * (1 - v) +
    hash2(xi + 1, yi, seed) * u * (1 - v) +
    hash2(xi, yi + 1, seed) * (1 - u) * v +
    hash2(xi + 1, yi + 1, seed) * u * v
  );
};

const colorFor = (
  mix: string | undefined,
  index: number,
  palette: Palette,
  alternate = palette.accent2,
) => {
  if (mix === "accent") return palette.accent;
  if (mix === "text") return palette.text;
  return index % 2 === 0 ? palette.accent : alternate;
};

const pointFor = (
  distribution: string | undefined,
  seed: number,
  index: number,
  count: number,
) => {
  if (distribution === "radial") {
    const angle = keyedRandom(seed, `angle-${index}`) * Math.PI * 2;
    const radius = Math.sqrt(keyedRandom(seed, `radius-${index}`)) * 46;
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    };
  }
  if (distribution === "grid") {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: ((col + 0.5) / cols) * 100 + (keyedRandom(seed, `gx-${index}`) - 0.5) * 6,
      y: ((row + 0.5) / rows) * 100 + (keyedRandom(seed, `gy-${index}`) - 0.5) * 6,
    };
  }
  if (distribution === "linear") {
    const x = keyedRandom(seed, `lx-${index}`) * 100;
    return {
      x,
      y: 50 + (x - 50) * 0.5 + (keyedRandom(seed, `ly-${index}`) - 0.5) * 20,
    };
  }
  return {
    x: keyedRandom(seed, `x-${index}`) * 100,
    y: keyedRandom(seed, `y-${index}`) * 100,
  };
};

const Dust: React.FC<{
  count: number;
  seed: number;
  palette: Palette;
  cycle: number;
  duration: number;
  distribution?: string;
  colorMix?: string;
  sizeScale?: number;
  speedScale?: number;
}> = ({
  count,
  seed,
  palette,
  cycle,
  duration,
  distribution,
  colorMix,
  sizeScale = 1,
  speedScale = 1,
}) => {
  const dots = Array.from({ length: count }, (_, i) => {
    const point = pointFor(distribution, seed, i, count);
    return {
      ...point,
      size: (1.5 + keyedRandom(seed, `size-${i}`) * 4.5) * sizeScale,
      phase: keyedRandom(seed, `phase-${i}`) * Math.PI * 2,
      speed:
        (0.6 + keyedRandom(seed, `speed-${i}`) * 0.9) * speedScale,
      opacity: 0.15 + keyedRandom(seed, `opacity-${i}`) * 0.55,
      color: colorFor(colorMix, i, palette),
    };
  });
  return (
    <>
      {dots.map((dot, i) => {
        const cyclesX = Math.max(
          1,
          Math.round((0.18 * dot.speed * duration) / (Math.PI * 2)),
        );
        const cyclesY = Math.max(
          1,
          Math.round((0.14 * dot.speed * duration) / (Math.PI * 2)),
        );
        const cyclesF = Math.max(
          1,
          Math.round((0.9 * dot.speed * duration) / (Math.PI * 2)),
        );
        const phase = cycle * Math.PI * 2;
        const x = dot.x + Math.sin(phase * cyclesX + dot.phase) * 2.2;
        const y = dot.y + Math.cos(phase * cyclesY + dot.phase) * 2.2;
        const flicker =
          0.65 + 0.35 * Math.sin(phase * cyclesF + dot.phase);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              background: dot.color,
              opacity: dot.opacity * flicker,
              boxShadow: `0 0 ${dot.size * 3}px ${dot.color}`,
            }}
          />
        );
      })}
    </>
  );
};

const Orbs: React.FC<{
  count: number;
  seed: number;
  palette: Palette;
  cycle: number;
  duration: number;
  distribution?: string;
  colorMix?: string;
  sizeScale?: number;
  speedScale?: number;
}> = ({
  count,
  seed,
  palette,
  cycle,
  duration,
  distribution,
  colorMix,
  sizeScale = 1,
  speedScale = 1,
}) => {
  const orbs = Array.from({ length: count }, (_, i) => {
    const point = pointFor(distribution, seed, i, count);
    return {
      x: distribution ? point.x : 18 + point.x * 0.64,
      y: distribution ? point.y : 18 + point.y * 0.64,
      size: (360 + keyedRandom(seed, `os-${i}`) * 460) * sizeScale,
      phase: keyedRandom(seed, `op-${i}`) * Math.PI * 2,
      speed:
        (0.12 + keyedRandom(seed, `ov-${i}`) * 0.12) * speedScale,
      color: colorFor(colorMix, i, palette),
      opacity: 0.25 + keyedRandom(seed, `oo-${i}`) * 0.2,
    };
  });
  return (
    <>
      {orbs.map((orb, i) => {
        const cycleX = Math.max(
          1,
          Math.round((orb.speed * duration) / (Math.PI * 2)),
        );
        const cycleY = Math.max(
          1,
          Math.round((orb.speed * 1.3 * duration) / (Math.PI * 2)),
        );
        const phase = cycle * Math.PI * 2;
        const x = orb.x + Math.sin(phase * cycleX + orb.phase) * 16;
        const y = orb.y + Math.cos(phase * cycleY + orb.phase) * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${x}% - ${orb.size / 2}px)`,
              top: `calc(${y}% - ${orb.size / 2}px)`,
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 68%)`,
              filter: "blur(38px)",
              opacity: orb.opacity,
            }}
          />
        );
      })}
    </>
  );
};

const Flow: React.FC<{
  lines: number;
  seed: number;
  palette: Palette;
  t: number;
  distribution?: string;
  colorMix?: string;
  sizeScale?: number;
  speedScale?: number;
}> = ({
  lines,
  seed,
  palette,
  t,
  distribution,
  colorMix,
  sizeScale = 1,
  speedScale = 1,
}) => {
  const flow = Array.from({ length: lines }, (_, i) => {
    const point = pointFor(distribution, seed, i, lines);
    return {
      x: point.x,
      y: point.y * 1.78,
      speed:
        (0.5 + keyedRandom(seed, `fs-${i}`) * 1.2) * speedScale,
      phase: keyedRandom(seed, `fp-${i}`) * Math.PI * 2,
      opacity: 0.08 + keyedRandom(seed, `fo-${i}`) * 0.22,
      color: colorFor(colorMix, i, palette, palette.text),
    };
  });
  const step = 1.8 * Math.max(0.8, sizeScale);
  return (
    <svg
      viewBox="0 0 100 177.78"
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%" }}
    >
      {flow.map((line, i) => {
        let x = line.x;
        let y = line.y;
        const points = [];
        for (let stepIndex = 0; stepIndex < 18; stepIndex += 1) {
          const angle =
            smoothNoise(x * 0.035, y * 0.035, seed + i) * Math.PI * 2 +
            t * 0.12 * line.speed +
            line.phase * 0.15;
          x += Math.cos(angle) * step;
          y += Math.sin(angle) * step;
          points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
        }
        return (
          <polyline
            key={i}
            points={points.join(" ")}
            fill="none"
            stroke={line.color}
            strokeWidth={0.16 * sizeScale}
            opacity={line.opacity}
          />
        );
      })}
    </svg>
  );
};

export const ParticleAtom: React.FC<PresetProps> = ({
  alpha,
  palette = "aurora",
  code = "P01",
  seed = 1,
  count = 80,
  lines = 90,
  background,
  light = "center",
  distribution,
  colorMix,
  sizeScale = 1,
  speedScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const duration = durationInFrames / fps;
  const cycle =
    durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
  const p = paletteOf(palette);
  const backdrop = background ?? (alpha ? "none" : "glow");
  return (
    <AbsoluteFill
      style={{
        backgroundColor: alpha ? "transparent" : p.bg,
        overflow: "hidden",
      }}
    >
      <Backdrop palette={p} background={backdrop} light={light} alpha={alpha} />
      {code === "P01" ? (
        <Dust
          count={count}
          seed={seed}
          palette={p}
          cycle={cycle}
          duration={duration}
          distribution={distribution}
          colorMix={colorMix}
          sizeScale={sizeScale}
          speedScale={speedScale}
        />
      ) : null}
      {code === "P04" ? (
        <Orbs
          count={count}
          seed={seed}
          palette={p}
          cycle={cycle}
          duration={duration}
          distribution={distribution}
          colorMix={colorMix}
          sizeScale={sizeScale}
          speedScale={speedScale}
        />
      ) : null}
      {code === "P05" ? (
        <Flow
          lines={lines}
          seed={seed}
          palette={p}
          t={t}
          distribution={distribution}
          colorMix={colorMix}
          sizeScale={sizeScale}
          speedScale={speedScale}
        />
      ) : null}
    </AbsoluteFill>
  );
};
