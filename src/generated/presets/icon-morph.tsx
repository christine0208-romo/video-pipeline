import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, keyedRandom } from "../../platform";
import { SOCIAL_ICONS } from "../../assets";
import { paletteOf } from "../palette";
import { Caption, IconTile } from "../parts";
import type { PresetProps } from "../types";

const STEP = 0.85;

export const IconMorph: React.FC<PresetProps> = ({
  alpha,
  seed = 1,
  icons = SOCIAL_ICONS.slice(0, 4),
  labels,
  palette = "aurora",
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = paletteOf(palette);
  const count = Math.max(2, icons.length);
  const index = Math.floor(t / STEP);
  const local = (t % STEP) / STEP;
  const wipe = local * local * (3 - 2 * local);
  const current = icons[index % count];
  const next = icons[(index + 1) % count];
  const label = labels?.[index % count] ?? title;
  const shine = ((t * 0.55) % 1) * 1100 - 550;

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
            background: `radial-gradient(55% 42% at 50% 46%, ${p.glow}, transparent 72%)`,
          }}
        />
      ) : null}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: 560,
            height: 560,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 460 + 30 * Math.sin(t * 2),
              height: 460 + 30 * Math.sin(t * 2),
              borderRadius: "50%",
              border: `2px dashed ${p.accent}44`,
              transform: `rotate(${t * 22}deg)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 380,
              height: 380,
              borderRadius: "50%",
              border: `1px solid ${p.accent2}55`,
              opacity: 0.7,
            }}
          />

          <div
            style={{
              position: "absolute",
              opacity: 1 - wipe * 0.35,
              transform: `scale(${1 - 0.08 * wipe}) rotate(${-5 * wipe}deg)`,
            }}
          >
            <IconTile src={current} size={280} radius={72} palette={p} />
          </div>

          <div
            style={{
              position: "absolute",
              clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
              transform: `scale(${0.92 + 0.08 * wipe}) rotate(${5 * (1 - wipe)}deg)`,
            }}
          >
            <IconTile src={next} size={280} radius={72} palette={p} />
          </div>

          <div
            style={{
              position: "absolute",
              inset: -40,
              overflow: "hidden",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -160,
                left: shine,
                width: 150,
                height: 900,
                transform: "rotate(20deg)",
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)",
              }}
            />
          </div>

          {Array.from({ length: 6 }, (_, i) => {
            const angle = keyedRandom(seed, `spark-angle-${i}`) * Math.PI * 2 + t * 0.4;
            const radius = 300 + keyedRandom(seed, `spark-radius-${i}`) * 90;
            const size = 6 + keyedRandom(seed, `spark-size-${i}`) * 10;
            return (
              <div
                key={`spark-${i}`}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: p.accent,
                  opacity: 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i)),
                  transform: `translate(${Math.cos(angle) * radius}px, ${
                    Math.sin(angle) * radius
                  }px)`,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      {label ? (
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            bottom: 300,
            textAlign: "center",
            fontFamily: '"JetBrains Mono"',
            fontSize: 34,
            letterSpacing: "0.14em",
            color: p.text2,
            opacity: clamp01(local * 2),
          }}
        >
          {label}
        </div>
      ) : null}
      <Caption text={title} palette={p} t={t} />
    </AbsoluteFill>
  );
};
