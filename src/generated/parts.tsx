import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { clamp01 } from "../platform";
import { WHITE_ICONS } from "../assets";
import type { Palette } from "./palette";

export const IconTile: React.FC<{
  src: string;
  size: number;
  palette: Palette;
  radius?: number;
  opacity?: number;
  scale?: number;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ src, size, palette, radius, opacity = 1, scale = 1, rotate = 0, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius ?? size * 0.26,
      background: palette.tile,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px ${palette.line}`,
      opacity,
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      ...style,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: size * 0.58,
        height: size * 0.58,
        objectFit: "contain",
        filter: WHITE_ICONS.has(src) ? "invert(1)" : undefined,
      }}
    />
  </div>
);

export const Caption: React.FC<{ text?: string; palette: Palette; t: number }> = ({
  text,
  palette,
  t,
}) =>
  text ? (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 250,
        textAlign: "center",
        fontFamily: '"Noto Sans SC"',
        fontWeight: 900,
        fontSize: 56,
        letterSpacing: "0.04em",
        color: palette.text,
        opacity: clamp01(t * 2),
        textShadow: "0 6px 30px rgba(0,0,0,0.45)",
      }}
    >
      {text}
    </div>
  ) : null;

export const DotGrid: React.FC<{
  palette: Palette;
  opacity?: number;
  step?: number;
}> = ({ palette, opacity = 0.1, step = 54 }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(circle, ${palette.text} 1px, transparent 1px)`,
      backgroundSize: `${step}px ${step}px`,
      opacity,
    }}
  />
);
