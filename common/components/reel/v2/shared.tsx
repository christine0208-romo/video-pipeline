import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01 } from "../../../engine";
import { MarkerHighlight } from "../../../vendor/fy-implementations/type-cn";
import type { TransitionIn } from "./types";

export type ReelTheme = {
  mode: "dark" | "light";
  bg: string;
  bg2: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accent2: string;
  warn: string;
  line: string;
  panel: string;
  display: string;
  body: string;
  mono: string;
};

export const PAPER: ReelTheme = {
  mode: "light",
  bg: "#F4F0E6",
  bg2: "#E7DFCE",
  text: "#24221D",
  text2: "#6F6A5E",
  text3: "#A39C8E",
  accent: "#D95F4C",
  accent2: "#3F7FB5",
  warn: "#C4493A",
  line: "rgba(36,34,29,0.16)",
  panel: "rgba(255,255,255,0.88)",
  display: '"Noto Sans SC"',
  body: '"Noto Sans SC"',
  mono: '"JetBrains Mono"',
};

export const BROADCAST: ReelTheme = {
  mode: "dark",
  bg: "#070B12",
  bg2: "#0E1724",
  text: "#F4F7FB",
  text2: "#A7B4C6",
  text3: "#607087",
  accent: "#FF4D3D",
  accent2: "#3D8BFF",
  warn: "#FFC857",
  line: "rgba(255,255,255,0.14)",
  panel: "rgba(9,14,22,0.88)",
  display: '"Noto Sans SC"',
  body: '"Inter"',
  mono: '"JetBrains Mono"',
};

export const NOTES: ReelTheme = {
  mode: "light",
  bg: "#FAF7EF",
  bg2: "#E9E2D2",
  text: "#2B2A26",
  text2: "#6B665B",
  text3: "#A39C8E",
  accent: "#C4493A",
  accent2: "#3F7FB5",
  warn: "#C4493A",
  line: "rgba(43,42,38,0.18)",
  panel: "rgba(255,255,255,0.72)",
  display: '"Ma Shan Zheng"',
  body: '"Noto Sans SC"',
  mono: '"JetBrains Mono"',
};

export const JOURNEY: ReelTheme = {
  mode: "light",
  bg: "#F6F4EE",
  bg2: "#E4DED0",
  text: "#1D232A",
  text2: "#5C6673",
  text3: "#97A0AA",
  accent: "#2F6FED",
  accent2: "#D9553F",
  warn: "#B84435",
  line: "rgba(29,35,42,0.14)",
  panel: "rgba(255,255,255,0.9)",
  display: '"Noto Sans SC"',
  body: '"Noto Sans SC"',
  mono: '"JetBrains Mono"',
};

export const Content: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <AbsoluteFill
    style={{
      left: 64,
      right: 120,
      top: 220,
      bottom: 320,
      width: "auto",
      height: "auto",
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Kicker: React.FC<{ text?: string; theme: ReelTheme; t: number }> = ({ text, theme, t }) => {
  if (!text) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        fontFamily: theme.mono,
        fontSize: 20,
        letterSpacing: "0.18em",
        color: theme.accent,
        opacity: clamp01(t / 0.25),
      }}
    >
      <span style={{ width: 26, height: 2, background: theme.accent }} />
      {text}
    </div>
  );
};

export const Rich: React.FC<{
  text: string;
  emphasis?: string[];
  theme: ReelTheme;
  t: number;
  at?: number;
}> = ({ text, emphasis, theme, t, at = 0 }) => {
  const words = (emphasis ?? []).filter((w) => w && text.includes(w));
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );
  const chunks = text.split(pattern).filter(Boolean);
  return (
    <>
      {chunks.map((chunk, i) =>
        words.includes(chunk) ? (
          <MarkerHighlight key={i} t={t} at={at + i * 0.08} duration={0.34} color={`${theme.accent}55`}>
            <span style={{ color: theme.accent }}>{chunk}</span>
          </MarkerHighlight>
        ) : (
          <span key={i}>{chunk}</span>
        ),
      )}
    </>
  );
};

export const BeatTransition: React.FC<{ type?: TransitionIn }> = ({ type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (type === "zoom") {
    const p = Math.max(0, 1 - t / 0.26);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 28%, rgba(0,0,0,0.62) 100%)",
          opacity: p,
          transform: `scale(${1 + 0.06 * p})`,
        }}
      />
    );
  }
  if (type === "wipe") {
    const p = Math.max(0, 1 - t / 0.3);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "#fff",
          opacity: p * 0.92,
          transform: `translateX(${(1 - p) * 100}%)`,
        }}
      />
    );
  }
  return null;
};

export const textSize = (text: string, max = 96) => {
  if (text.length > 24) return Math.round(max * 0.55);
  if (text.length > 16) return Math.round(max * 0.7);
  if (text.length > 10) return Math.round(max * 0.85);
  return max;
};
