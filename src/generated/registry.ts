import type React from "react";
import meta from "./presets.json";
import type { PresetMeta, PresetProps } from "./types";
import { PlatformOrbit } from "./presets/platform-orbit";
import { SocialConstellation } from "./presets/social-constellation";
import { NetworkUniverse } from "./presets/network-universe";
import { IconMorph } from "./presets/icon-morph";
import { IconGlitchScatter } from "./presets/icon-glitch-scatter";
import { UiMock } from "./presets/ui-mock";
import { KineticGrid } from "./presets/kinetic-grid";
import { TextAtom } from "./atoms/text-atom";
import { TransitionAtom } from "./atoms/transition-atom";
import { ParticleAtom } from "./atoms/particle-atom";
import { CameraScene } from "./atoms/camera-scene";

export type PresetComponent = React.FC<PresetProps>;

export const PRESET_META = meta.presets as PresetMeta[];

const COMPONENTS: Record<string, PresetComponent> = {
  "platform-orbit": PlatformOrbit,
  "social-constellation": SocialConstellation,
  "network-universe": NetworkUniverse,
  "icon-morph": IconMorph,
  "icon-glitch-scatter": IconGlitchScatter,
  "ui-mock": UiMock,
  "kinetic-grid": KineticGrid,
  "text-atom": TextAtom,
  "transition-atom": TransitionAtom,
  "particle-atom": ParticleAtom,
  "camera-scene": CameraScene,
};

export const PRESETS: Record<string, { meta: PresetMeta; Component: PresetComponent }> =
  Object.fromEntries(
    PRESET_META.filter((item) => COMPONENTS[item.id]).map((item) => [
      item.id,
      { meta: item, Component: COMPONENTS[item.id] },
    ]),
  );

export const PRESET_IDS = Object.keys(PRESETS);
