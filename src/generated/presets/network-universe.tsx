import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasStage, clamp01, keyedRandom } from "../../platform";
import { SOCIAL_ICONS, worldDots } from "../../assets";
import { paletteOf } from "../palette";
import { Caption, IconTile } from "../parts";
import type { PresetProps } from "../types";

const CITIES: Array<[number, number]> = [
  [250, 205],
  [470, 175],
  [690, 240],
  [800, 340],
  [520, 305],
  [355, 300],
  [610, 150],
];

const LINKS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 2],
  [1, 5],
  [4, 2],
  [5, 1],
  [6, 2],
  [0, 4],
];

const quad = (a: number, c: number, b: number, u: number) =>
  (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

export const NetworkUniverse: React.FC<PresetProps> = ({
  alpha,
  seed = 1,
  palette = "aurora",
  title,
  icons = SOCIAL_ICONS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = paletteOf(palette);

  const mapW = 940;
  const mapH = 470;
  const ox = (1080 - mapW) / 2;
  const oy = 690;
  const sx = mapW / worldDots.w;
  const sy = mapH / worldDots.h;
  const points = CITIES.map(([x, y]) => [ox + x * sx, oy + y * sy] as const);
  const scanLine = ((t * 0.35) % 1) * worldDots.h;

  const draw = (ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, 1080, 1920);

    if (!alpha) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, p.bg);
      gradient.addColorStop(1, p.bg2);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    ctx.fillStyle = p.accent;
    for (const [x, y] of worldDots.dots as Array<[number, number]>) {
      const px = ox + x * sx;
      const py = oy + y * sy;
      const wave = 0.5 + 0.5 * Math.sin(x * 0.035 + time * 1.5 + y * 0.02);
      const sweep = Math.max(0, 1 - Math.abs(y - scanLine) / 28);
      ctx.globalAlpha = 0.12 + 0.24 * wave + 0.3 * sweep;
      ctx.fillRect(px, py, 2.6, 2.6);
    }
    ctx.globalAlpha = 0.16;
    ctx.fillRect(ox, oy + scanLine * sy, mapW, 1.6);
    ctx.globalAlpha = 1;

    LINKS.forEach(([a, b], index) => {
      const [ax, ay] = points[a];
      const [bx, by] = points[b];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2 - Math.min(170, Math.abs(bx - ax) * 0.28 + 70);
      const progress = clamp01((time - 0.2 - index * 0.08) / 1);

      ctx.strokeStyle = p.accent2;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const steps = Math.max(2, Math.round(40 * progress));
      for (let step = 1; step <= steps; step += 1) {
        const u = (step / steps) * progress;
        ctx.lineTo(quad(ax, mx, bx, u), quad(ay, my, by, u));
      }
      ctx.stroke();

      const u = (time * 0.34 + index * 0.17) % 1;
      const px = quad(ax, mx, bx, u);
      const py = quad(ay, my, by, u);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const cx = 540;
    const cy = 900;
    for (let i = 0; i < 3; i += 1) {
      const radius = 100 + i * 58 + 12 * Math.sin(time * 2.4 + i);
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.3 - i * 0.07;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const beam = ctx.createLinearGradient(0, 320, 0, 860);
    beam.addColorStop(0, "rgba(255,255,255,0)");
    beam.addColorStop(1, p.glow);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = beam;
    ctx.fillRect(510, 320, 60, 540);

    const burst = Math.max(0, 1 - Math.abs(time - 1.7) / 0.3);
    if (burst > 0) {
      ctx.globalAlpha = burst * 0.8;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 620 * burst, cy);
      ctx.lineTo(cx + 620 * burst, cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: alpha ? "transparent" : p.bg,
        overflow: "hidden",
        fontFamily: '"Noto Sans SC"',
      }}
    >
      <CanvasStage draw={draw} width={1080} height={1920} />

      {points.slice(0, 4).map(([x, y], i) => (
        <div
          key={`node-${i}`}
          style={{
            position: "absolute",
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            opacity: clamp01((t - 0.25 - i * 0.1) / 0.5),
          }}
        >
          <IconTile
            src={icons[i % icons.length]}
            size={74}
            palette={p}
            scale={0.9 + 0.06 * keyedRandom(seed, `node-${i}`)}
          />
        </div>
      ))}

      <Caption text={title} palette={p} t={t} />
    </AbsoluteFill>
  );
};
