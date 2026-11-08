import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CanvasStage } from "../../platform";
import { SOCIAL_ICONS } from "../../assets";
import { paletteOf } from "../palette";
import { Caption, IconTile } from "../parts";
import type { PresetProps } from "../types";

export const KineticGrid: React.FC<PresetProps> = ({
  alpha,
  icons = SOCIAL_ICONS,
  palette = "aurora",
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = paletteOf(palette);
  const vp = { x: 540, y: 840 };

  const draw = (ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, 1080, 1920);

    if (!alpha) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, p.bg);
      gradient.addColorStop(0.5, p.bg2);
      gradient.addColorStop(1, p.bg);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    const glow = ctx.createRadialGradient(vp.x, vp.y, 20, vp.x, vp.y, 620);
    glow.addColorStop(0, p.glow);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.2;
    for (let x = -1200; x <= 2280; x += 120) {
      ctx.globalAlpha = 0.05 + 0.08 * (1 - Math.abs(x - vp.x) / 1800);
      ctx.beginPath();
      ctx.moveTo(vp.x, vp.y);
      ctx.lineTo(x, 1920);
      ctx.stroke();
    }

    for (let i = 0; i < 28; i += 1) {
      const z = (i / 28 + time * 0.34) % 1;
      const y = vp.y + (1920 - vp.y) * Math.pow(z, 2.2);
      ctx.globalAlpha = 0.03 + z * 0.22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1080, y);
      ctx.stroke();
    }

    for (let i = 0; i < 3; i += 1) {
      const radius = 96 + i * 62 + 14 * Math.sin(time * 3 + i);
      ctx.strokeStyle = i === 1 ? p.accent2 : p.accent;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.34 - i * 0.08;
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const beam = ctx.createLinearGradient(0, 240, 0, vp.y);
    beam.addColorStop(0, "rgba(255,255,255,0)");
    beam.addColorStop(1, p.glow);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = beam;
    ctx.fillRect(vp.x - 42, 240, 84, vp.y - 240);

    const burst = Math.max(0, 1 - Math.abs(time - 1.75) / 0.32);
    if (burst > 0) {
      ctx.globalAlpha = burst * 0.85;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(vp.x - 620 * burst, vp.y);
      ctx.lineTo(vp.x + 620 * burst, vp.y);
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

      {[0, 1, 2, 3, 4].map((i) => {
        const phase = (t * 0.38 + i * 0.19) % 1;
        const scale = 0.22 + phase * 1.15;
        const x = vp.x + Math.sin(i * 2.2) * 460 * phase;
        const y = vp.y + (i - 2) * 34 + 560 * phase;
        const opacity =
          phase < 0.14 ? phase / 0.14 : Math.max(0, 1 - (phase - 0.14) / 0.86);
        return (
          <div
            key={`fly-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <IconTile
              src={icons[i % icons.length]}
              size={92}
              palette={p}
              scale={scale}
              opacity={opacity}
            />
          </div>
        );
      })}

      <Caption text={title} palette={p} t={t} />
    </AbsoluteFill>
  );
};
