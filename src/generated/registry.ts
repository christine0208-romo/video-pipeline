import type React from "react";
import meta from "./presets.json";
import type { PresetMeta, PresetProps } from "./types";
import { PlatformOrbit } from "./presets/platform-orbit";
import { SocialConstellation } from "./presets/social-constellation";
import { NetworkUniverse } from "./presets/network-universe";
import { IconMorph } from "./presets/icon-morph";
import { UiMock } from "./presets/ui-mock";
import { KineticGrid } from "./presets/kinetic-grid";

export type PresetComponent = React.FC<PresetProps>;

export const PRESET_META = meta.presets as PresetMeta[];

const COMPONENTS: Record<string, PresetComponent> = {
  "platform-orbit": PlatformOrbit,
  "social-constellation": SocialConstellation,
  "network-universe": NetworkUniverse,
  "icon-morph": IconMorph,
  "ui-mock": UiMock,
  "kinetic-grid": KineticGrid,
};

export const PRESETS: Record<string, { meta: PresetMeta; Component: PresetComponent }> =
  Object.fromEntries(
    PRESET_META.filter((item) => COMPONENTS[item.id]).map((item) => [
      item.id,
      { meta: item, Component: COMPONENTS[item.id] },
    ]),
  );

export const PRESET_IDS = Object.keys(PRESETS);
