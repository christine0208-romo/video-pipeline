import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, keyedRandom } from "../../platform";
import { paletteOf } from "../palette";
import type { PresetProps } from "../types";

const GLITCH_COLORS = ["#FF3B30", "#00E5FF", "#FFFFFF"];

export const TransitionAtom: React.FC<PresetProps> = ({
  palette = "mono",
  transition = "flash",
  seed = 1,
  angle,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = clamp01(frame / Math.max(1, durationInFrames - 1));
  const fade = 1 - progress;
  const p = paletteOf(palette);
  const strength = Math.max(0, Math.min(1, intensity));

  if (transition === "flash") {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#FFFFFF",
          opacity: 0.75 * strength * fade,
        }}
      />
    );
  }

  if (transition === "wipe") {
    const left = -100 + progress * 220;
    const rotation = angle ?? -12;
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "transparent" }}>
        <div
          style={{
            position: "absolute",
            top: "-100%",
            bottom: "-100%",
            left: `${left}%`,
            width: "300%",
            background: `linear-gradient(90deg, ${p.accent} 0%, ${p.accent} 55%, ${p.accent2} 100%)`,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center",
            opacity: strength,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (transition === "glitch") {
    const bars = Array.from({
      length: Math.round(10 + strength * 8),
    }).map((_, i) => ({
      top: keyedRandom(seed, `top-${i}`) * 100,
      height: 1.5 + keyedRandom(seed, `height-${i}`) * 7,
      shift:
        (keyedRandom(seed, `shift-${i}`) - 0.5) *
        16 *
        strength *
        Math.sin(Math.PI * progress),
      color:
        GLITCH_COLORS[
          Math.floor(keyedRandom(seed, `color-${i}`) * GLITCH_COLORS.length)
        ],
    }));
    const split = Math.sin(Math.PI * progress) * 8 * strength;
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "transparent" }}>
        <AbsoluteFill style={{ backgroundColor: p.bg, opacity: 0.55 * fade }} />
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(255,0,80,0.22)",
            transform: `translateX(${-split}px)`,
            mixBlendMode: "screen",
          }}
        />
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(0,220,255,0.22)",
            transform: `translateX(${split}px)`,
            mixBlendMode: "screen",
          }}
        />
        {bars.map((bar, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${bar.top}%`,
              left: `${bar.shift}%`,
              width: "100%",
              height: `${bar.height}%`,
              backgroundColor: bar.color,
              opacity: 0.8 * strength * fade,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  if (transition === "light-leak") {
    const left = -30 + progress * 55;
    const rotation = angle ?? -20;
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "transparent" }}>
        <AbsoluteFill style={{ backgroundColor: p.bg, opacity: 0.35 * fade }} />
        <div
          style={{
            position: "absolute",
            top: "-40%",
            bottom: "-40%",
            left: `${left}%`,
            width: "85%",
            background: `radial-gradient(circle, ${p.accent2} 0%, ${p.accent} 38%, transparent 70%)`,
            opacity: 0.65 * strength * fade,
            filter: "blur(36px)",
            transform: `rotate(${rotation}deg)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return null;
};
