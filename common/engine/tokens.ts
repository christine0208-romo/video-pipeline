/**
 * 公共设计令牌。作品只在需要时覆盖，不要改这里去适配单个作品。
 * 这些键名同时是 Canvas 引擎 (common/vendor/canvas-engine) 的入参契约。
 */

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

/** TikTok 叠加 UI 避让区。左右/上下不是对称的，别当 padding 用。 */
export const SAFE = {
  left: 64,
  right: 860,
  wideRight: 1016,
  top: 150,
  bottom: 1600,
  cx: 540,
  tiktok: {
    railX: 860,
    railY1: 820,
    railY2: 1420,
    navY: 1630,
    notchX1: 300,
    notchX2: 760,
    notchY: 110,
  },
} as const;

export const COLORS = {
  bg0: "#04070C",
  bg1: "#0A1322",
  bg2: "#07101C",
  surface0: "#0A1018",
  surface1: "#0E1622",
  surface2: "#141F2E",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.16)",
  text: "#E9F0F8",
  text2: "#9AAABD",
  text3: "#5B6B80",
  accent: "#4DA6FF",
  accentDim: "#1E5C99",
  warn: "#FF3B47",
  warnDim: "#8A1F26",
  stageGlow: "rgba(45,120,210,0.16)",
  black: "#000000",
  white: "#FFFFFF",
} as const;

/** Canvas 引擎要的 TYPE 是三个 family 字符串；DOM 需要的是分阶字号。 */
export const TYPE = {
  zh: '"Noto Sans SC"',
  latin: '"Inter"',
  mono: '"JetBrains Mono"',
  display: 96,
  h1: 84,
  h2: 72,
  h3: 52,
  body: 40,
  small: 32,
  micro: 22,
} as const;

export const GRID = {
  module: 54,
  minor: 0.028,
  major: 0.062,
} as const;

/** 运动节奏只放跨作品共用的量；单个动作的曲线留在组件里。 */
export const MOTION = {
  beat: 0.5,
  quick: 0.35,
  slow: 0.8,
  sceneOverlap: 0.4,
} as const;

export const tokens = { VIDEO, SAFE, COLORS, TYPE, GRID, MOTION } as const;

export type Tokens = typeof tokens;
