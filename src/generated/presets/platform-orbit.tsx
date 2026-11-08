import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, keyedRandom, springAt } from "../../platform";
import { SOCIAL_ICONS } from "../../assets";
import { paletteOf } from "../palette";
import { Caption, IconTile } from "../parts";
import type { PresetProps } from "../types";

export const PlatformOrbit: React.FC<PresetProps> = ({
  alpha,
  seed = 1,
  icons = SOCIAL_ICONS,
  palette = "aurora",
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const duration = durationInFrames / fps;
  const p = paletteOf(palette);
  const count = Math.max(1, icons.length);
  const converge = clamp01((t - (duration - 1.05)) / 0.75);
  const spin = t * 0.5;

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
            background: `radial-gradient(58% 46% at 50% 47%, ${p.glow}, transparent 72%)`,
          }}
        />
      ) : null}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 820, height: 820, marginTop: -50 }}>
          {[0, 1, 2].map((i) => {
            const pop = springAt(Math.max(0, t - i * 0.12), {
              stiffness: 130,
              damping: 20,
            });
            const radius = 250 + i * 105;
            return (
              <div
                key={`ring-${i}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: radius * 2,
                  height: radius * 2,
                  marginLeft: -radius,
                  marginTop: -radius,
                  borderRadius: "50%",
                  border: `1px solid ${p.accent}${i === 0 ? "55" : "2e"}`,
                  opacity: clamp01(pop) * (0.7 - i * 0.15),
                  transform: `scale(${0.9 + 0.1 * pop + 0.02 * Math.sin(t * 1.5 + i)})`,
                }}
              />
            );
          })}

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 250,
              height: 250,
              marginLeft: -125,
              marginTop: -125,
            }}
          >
            <IconTile
              src={icons[0]}
              size={250}
              radius={62}
              palette={p}
              scale={0.82 + 0.18 * converge + 0.02 * Math.sin(t * 2)}
            />
          </div>

          {icons.map((icon, i) => {
            const phase =
              (i / count) * Math.PI * 2 -
              Math.PI / 2 +
              keyedRandom(seed, `phase-${i}`) * 0.22;
            const angle = phase + spin;
            const radius = (350 - 150 * converge) * (1 + 0.03 * Math.sin(t * 1.4 + i));
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius * 0.92;
            const pop = springAt(Math.max(0, t - 0.12 - i * 0.05), {
              stiffness: 180,
              damping: 16,
            });
            const size = 120 + 18 * Math.sin(t * 2 + i);
            return (
              <div
                key={icon}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(${x}px, ${y}px)`,
                  opacity: clamp01(pop),
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    transform: `translate(-50%, -50%) rotate(${Math.sin(t * 1.3 + i) * 4}deg)`,
                  }}
                >
                  <IconTile
                    src={icon}
                    size={size}
                    palette={p}
                    scale={0.75 + 0.25 * pop}
                  />
                </div>
              </div>
            );
          })}

          {[0, 1].map((i) => {
            const phase = (t * 0.8 + i * 0.5) % 1;
            const size = 340 + phase * 360;
            return (
              <div
                key={`scan-${i}`}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                  borderRadius: "50%",
                  border: `2px solid ${p.accent}`,
                  opacity: (1 - phase) * 0.22,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
      <Caption text={title} palette={p} t={t} />
    </AbsoluteFill>
  );
};
