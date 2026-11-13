import React from "react";
import { AbsoluteFill } from "remotion";
import type { Palette } from "../palette";

const lightPosition = (light?: string) => {
  switch (light) {
    case "top-left":
      return "22% 20%";
    case "top-right":
      return "78% 20%";
    case "bottom":
      return "50% 82%";
    default:
      return "50% 48%";
  }
};

export const Backdrop: React.FC<{
  palette: Palette;
  background?: string;
  light?: string;
  alpha?: boolean;
}> = ({ palette, background = "none", light = "center", alpha }) => {
  if (background === "glow") {
    return (
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 50% at ${lightPosition(light)}, ${palette.glow}, transparent 72%)`,
          opacity: alpha ? 0.6 : 1,
        }}
      />
    );
  }
  if (background === "gradient") {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${palette.bg2}, ${palette.bg})`,
          opacity: alpha ? 0.55 : 1,
        }}
      />
    );
  }
  if (background === "grid") {
    return (
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${palette.line} 1px, transparent 1px), linear-gradient(90deg, ${palette.line} 1px, transparent 1px)`,
          backgroundSize: "54px 54px",
          opacity: alpha ? 0.35 : 0.5,
        }}
      />
    );
  }
  if (background === "dots") {
    return (
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(circle, ${palette.text} 1px, transparent 1px)`,
          backgroundSize: "54px 54px",
          opacity: alpha ? 0.3 : 0.45,
        }}
      />
    );
  }
  return null;
};
