export type EngineProps = {
  alpha?: boolean;
  [key: string]: unknown;
};

export type PresetMeta = {
  id: string;
  supportsAlpha: boolean;
  description: string;
  [key: string]: unknown;
};

export type AssetProps = {
  preset: string;
  props?: EngineProps;
  alpha?: boolean;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};
