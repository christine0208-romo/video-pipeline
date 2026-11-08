export type PaletteName = "aurora" | "ember" | "mono" | "lime" | "ice";

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
};

export type PresetMeta = {
  id: string;
  supportsAlpha: boolean;
  description: string;
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
