import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, keyedRandom, springAt } from "../../platform";
import { SOCIAL_ICONS } from "../../assets";
import { paletteOf } from "../palette";
import { Caption, DotGrid, IconTile } from "../parts";
import type { PresetProps } from "../types";

export const SocialConstellation: React.FC<PresetProps> = ({
  alpha,
  seed = 1,
  icons = SOCIAL_ICONS,
  palette = "aurora",
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = paletteOf(palette);
  const count = Math.max(2, icons.length);

  const nodes = icons.map((icon, i) => {
    const base = (i / count) * Math.PI * 2 - Math.PI / 2;
    const angle = base + keyedRandom(seed, `angle-${i}`) * 0.12;
    const radius = 300 + keyedRandom(seed, `radius-${i}`) * 90;
    const pop = springAt(Math.max(0, t - 0.1 - i * 0.07), {
      stiffness: 170,
      damping: 17,
    });
    return {
      icon,
      x: 540 + Math.cos(angle) * radius,
      y: 880 + Math.sin(angle) * radius * 0.9,
      pop,
      pulse: keyedRandom(seed, `pulse-${i}`),
    };
  });

  const edges: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    edges.push([i, (i + 1) % count]);
    if (count > 4) edges.push([i, (i + 3) % count]);
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: alpha ? "transparent" : p.bg,
        overflow: "hidden",
        fontFamily: '"Noto Sans SC"',
      }}
    >
      {!alpha ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 45% at 50% 48%, ${p.glow}, transparent 74%)`,
          }}
        />
      ) : null}
      <DotGrid palette={p} opacity={alpha ? 0.06 : 0.11} step={58} />

      <svg
        width={1080}
        height={1920}
        style={{ position: "absolute", inset: 0 }}
        viewBox="0 0 1080 1920"
      >
        {edges.map(([a, b], index) => {
          const from = nodes[a];
          const to = nodes[b];
          const appear = clamp01((t - 0.25 - index * 0.05) / 0.6);
          return (
            <line
              key={`edge-${a}-${b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={p.accent}
              strokeWidth={1.6}
              strokeDasharray="10 16"
              strokeDashoffset={-t * 46 - index * 7}
              opacity={appear * (0.16 + 0.12 * Math.sin(t * 2 + index))}
            />
          );
        })}
        {nodes.map((node, i) => {
          const ring = (t * 0.55 + node.pulse) % 1;
          return (
            <circle
              key={`pulse-${i}`}
              cx={node.x}
              cy={node.y}
              r={70 + ring * 80}
              fill="none"
              stroke={p.accent2}
              strokeWidth={1.4}
              opacity={(1 - ring) * 0.3 * clamp01(node.pop)}
            />
          );
        })}
      </svg>

      {nodes.map((node, i) => (
        <div
          key={node.icon}
          style={{
            position: "absolute",
            left: node.x,
            top: node.y,
            transform: `translate(-50%, -50%) rotate(${Math.sin(t * 1.1 + i) * 3}deg)`,
            opacity: clamp01(node.pop),
          }}
        >
          <IconTile
            src={node.icon}
            size={112}
            palette={p}
            scale={0.7 + 0.3 * node.pop}
          />
        </div>
      ))}

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 176,
            height: 176,
            borderRadius: "50%",
            border: `1px solid ${p.accent2}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.9,
            transform: `scale(${1 + 0.04 * Math.sin(t * 2.4)})`,
            boxShadow: `0 0 80px ${p.glow}`,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: p.tile,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: `6px solid ${p.accent}`,
                borderTopColor: "transparent",
                transform: `rotate(${t * 120}deg)`,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      <Caption text={title} palette={p} t={t} />
    </AbsoluteFill>
  );
};
