export type PaletteName =
  | "aurora"
  | "ember"
  | "mono"
  | "lime"
  | "ice"
  | "violet"
  | "ocean"
  | "sand"
  | "candy"
  | "forest"
  | "cyber";

export type PresetProps = {
  alpha?: boolean;
  seed?: number;
  icons?: string[];
  labels?: string[];
  palette?: PaletteName;
  title?: string;
  clip?: "platform-icon" | "gate" | "sms" | "call" | "account";
  platform?: string;
  icon?: string;
  variant?: number;
  duration?: number;
  code?: string;
  text?: string;
  keyword?: string;
  fontSize?: number;
  fontWeight?: number;
  distanceEm?: number;
  staggerFrames?: number;
  countFrom?: number;
  countTo?: number;
  prefix?: string;
  suffix?: string;
  transition?: "flash" | "wipe" | "glitch" | "light-leak";
  count?: number;
  lines?: number;
  basePreset?: string;
  baseProps?: PresetProps;
  move?: "push" | "pull" | "zoom" | "shake";
  amount?: number;
  align?: "left" | "center" | "right";
  vertical?: "top" | "center" | "bottom";
  maxWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  background?: "none" | "glow" | "grid" | "dots" | "gradient";
  light?: "center" | "top-left" | "top-right" | "bottom";
  distribution?: "random" | "radial" | "grid" | "linear";
  colorMix?: "mixed" | "accent" | "text";
  sizeScale?: number;
  countScale?: number;
  speedScale?: number;
  post?: "none" | "grain" | "vignette" | "scanline";
  grade?: {
    saturation?: number;
    contrast?: number;
    brightness?: number;
  };
  angle?: number;
  intensity?: number;
  glitchIndex?: number;
  glitchLabel?: string;
  glitchStart?: number;
};

export type PresetMeta = {
  id: string;
  supportsAlpha: boolean;
  description: string;
  category?: string;
  series?: string;
  seriesIndex?: number;
  loop?: boolean;
  complete?: "hold" | "clear" | "loop";
};

export type AssetProps = {
  preset: string;
  props?: PresetProps;
  alpha?: boolean;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};
