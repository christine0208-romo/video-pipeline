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

export type MixShot = {
  kind: "footage" | "generated" | "image";
  assetId: string;
  src: string;
  sourceFps?: number;
  in?: number;
  at: number;
  dur: number;
  speed?: number;
  transform?: ShotTransform;
  overlay?: { assetId: string; src: string; dur: number };
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
  audio?: { src: string; volume?: number } | null;
  beats: MixBeat[];
  stats?: Record<string, unknown>;
};
