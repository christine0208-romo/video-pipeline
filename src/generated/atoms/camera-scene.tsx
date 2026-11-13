import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, easeOutCubic } from "../../platform";
import { paletteOf } from "../palette";
import { PlatformOrbit } from "../presets/platform-orbit";
import { SocialConstellation } from "../presets/social-constellation";
import { NetworkUniverse } from "../presets/network-universe";
import { IconMorph } from "../presets/icon-morph";
import { UiMock } from "../presets/ui-mock";
import { KineticGrid } from "../presets/kinetic-grid";
import type { PresetProps } from "../types";
import { easeOutExpo } from "./easing";

const BASES: Record<string, React.FC<PresetProps>> = {
  "platform-orbit": PlatformOrbit,
  "social-constellation": SocialConstellation,
  "network-universe": NetworkUniverse,
  "icon-morph": IconMorph,
  "ui-mock": UiMock,
  "kinetic-grid": KineticGrid,
};

const PostLayer: React.FC<{ post?: string; frame: number }> = ({
  post,
  frame,
}) => {
  if (post === "grain") {
    return (
      <AbsoluteFill
        style={{
          opacity: 0.1,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.8) 0.6px, transparent 0.7px)",
          backgroundSize: "3px 3px",
          backgroundPosition: `${(frame * 7) % 3}px ${(frame * 11) % 3}px`,
        }}
      />
    );
  }
  if (post === "vignette") {
    return (
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    );
  }
  if (post === "scanline") {
    return (
      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 4px)",
        }}
      />
    );
  }
  return null;
};

export const CameraScene: React.FC<PresetProps> = ({
  palette = "aurora",
  seed = 1,
  basePreset = "platform-orbit",
  baseProps = {},
  move = "push",
  amount = 0.06,
  post = "none",
  grade,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const total = durationInFrames / fps;
  const p = clamp01(t / Math.max(total, 0.001));
  const Base = BASES[basePreset] ?? PlatformOrbit;

  let scale = 1;
  let tx = 0;
  let ty = 0;
  if (move === "push") scale = 1 + amount * easeOutCubic(p);
  if (move === "pull") scale = 1 + amount * (1 - easeOutCubic(p));
  if (move === "zoom") {
    const q = clamp01(t / 0.13);
    scale = 1 + 0.25 * easeOutExpo(q);
  }
  if (move === "shake") {
    const decay = Math.exp(-6 * t);
    tx = Math.sin(t * 38) * 8 * decay;
    ty = Math.cos(t * 31) * 6 * decay;
    scale = 1.02;
  }

  const gradeFilter = grade
    ? `saturate(${grade.saturation ?? 1}) contrast(${
        grade.contrast ?? 1
      }) brightness(${grade.brightness ?? 1})`
    : undefined;

  const mergedBaseProps: PresetProps = {
    ...baseProps,
    palette: baseProps.palette ?? palette,
    seed: baseProps.seed ?? seed,
  };

  return (
    <AbsoluteFill
      style={{ overflow: "hidden", backgroundColor: paletteOf(palette).bg }}
    >
      <AbsoluteFill
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: "center",
          filter: gradeFilter,
        }}
      >
        <Base {...mergedBaseProps} alpha={false} />
      </AbsoluteFill>
      <PostLayer post={post} frame={frame} />
    </AbsoluteFill>
  );
};
