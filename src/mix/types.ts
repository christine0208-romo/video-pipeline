export type TransitionIn = "cut" | "flash" | "whip" | "zoom" | "wipe";

export type ShotGrade = {
  saturation?: number;
  contrast?: number;
  brightness?: number;
};

export type ShotTransform = {
  focus?: [number, number];
  zoom?: number;
  motion?: "push" | "pull" | "panLeft" | "panRight" | "panUp" | "panDown" | "still";
  motionAmount?: number;
  grade?: ShotGrade;
  overlay?: "none" | "grain" | "scanline" | "vignette";
};

export type MixAudioMusic = {
  src: string;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  duckTo?: number;
  loop?: boolean;
  bpm?: number | null;
  title?: string;
  artist?: string;
  license?: string;
  attribution?: string;
  attributionRequired?: boolean;
};

export type MixAudioSfx = {
  src: string;
  at: number;
  dur?: number;
  volume?: number;
  category?: string;
  assetId?: string;
  shotIndex?: number;
};

export type MixAudio = {
  src?: string;
  volume?: number;
  music?: MixAudioMusic | null;
  sfx?: MixAudioSfx[];
};

export type MixShot = {
  kind: "footage" | "generated" | "image";
  assetId: string;
  recipeId?: string;
  src: string;
  sourceFps?: number;
  in?: number;
  at: number;
  dur: number;
  speed?: number;
  transform?: ShotTransform;
  overlay?: { assetId: string; src: string; dur: number; blend?: "screen" | "normal" };
  transitionAsset?: { assetId: string; src: string; dur: number };
  transitionIn?: TransitionIn;
  signature?: string;
};

export type MixBeat = {
  id: string;
  role: string;
  at: number;
  dur: number;
  shots: MixShot[];
};

export type MixEdl = {
  version: 1;
  id: string;
  title?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  stills: number[];
  beatFrames?: number | null;
  workProfile?: string | null;
  variation?: Record<string, unknown> | null;
  audio?: MixAudio | null;
  beats: MixBeat[];
  stats?: Record<string, unknown>;
};
