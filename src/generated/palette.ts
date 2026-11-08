import type { PaletteName } from "./types";

export type Palette = {
  bg: string;
  bg2: string;
  accent: string;
  accent2: string;
  glow: string;
  text: string;
  text2: string;
  line: string;
  tile: string;
};

export const PALETTES: Record<PaletteName, Palette> = {
  aurora: {
    bg: "#04070C",
    bg2: "#0A1322",
    accent: "#4DA6FF",
    accent2: "#35E0C8",
    glow: "rgba(77,166,255,0.22)",
    text: "#E9F0F8",
    text2: "#9AAABD",
    line: "rgba(255,255,255,0.14)",
    tile: "rgba(255,255,255,0.96)",
  },
  ember: {
    bg: "#0A0605",
    bg2: "#1A0E0A",
    accent: "#FF6A3D",
    accent2: "#FFC857",
    glow: "rgba(255,106,61,0.22)",
    text: "#FFF3EC",
    text2: "#D6B3A4",
    line: "rgba(255,255,255,0.14)",
    tile: "rgba(255,248,243,0.96)",
  },
  mono: {
    bg: "#0A0A0B",
    bg2: "#17171A",
    accent: "#F2F4F7",
    accent2: "#9AAABD",
    glow: "rgba(255,255,255,0.12)",
    text: "#FFFFFF",
    text2: "#A7A7AD",
    line: "rgba(255,255,255,0.16)",
    tile: "#FFFFFF",
  },
  lime: {
    bg: "#050805",
    bg2: "#0C170D",
    accent: "#B6FF4D",
    accent2: "#4DFFC2",
    glow: "rgba(182,255,77,0.18)",
    text: "#F2FFE9",
    text2: "#A9C09B",
    line: "rgba(255,255,255,0.14)",
    tile: "rgba(248,255,242,0.96)",
  },
  ice: {
    bg: "#050A12",
    bg2: "#0B1726",
    accent: "#8FD3FF",
    accent2: "#C7F0FF",
    glow: "rgba(143,211,255,0.2)",
    text: "#F0F8FF",
    text2: "#9EB4C8",
    line: "rgba(255,255,255,0.15)",
    tile: "rgba(250,253,255,0.96)",
  },
};

export const paletteOf = (name?: string): Palette =>
  PALETTES[(name as PaletteName) ?? "aurora"] ?? PALETTES.aurora;
