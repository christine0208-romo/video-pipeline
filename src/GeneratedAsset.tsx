import React from "react";
import { AbsoluteFill } from "remotion";
import { useFonts } from "./platform";
import { FONT_MANIFEST, PRESETS } from "../creative/registry";
import type { AssetProps } from "./types";

export const GeneratedAsset: React.FC<AssetProps> = ({ preset, props = {}, alpha }) => {
  const ready = useFonts(FONT_MANIFEST);
  if (!ready) return null;

  const entry = PRESETS[preset];
  if (!entry) throw new Error(`未知 preset：${preset}`);
  const Component = entry.Component;

  return (
    <AbsoluteFill
      style={{ backgroundColor: alpha ? "transparent" : "#04070C" }}
    >
      <Component {...props} alpha={alpha || props.alpha} />
    </AbsoluteFill>
  );
};
