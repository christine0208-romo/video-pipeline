import worldDots from "../common/assets/map/world-dots.json";
import data from "./generated/assets.json";

export { worldDots };

export const ICON = data.icons;
export const SOCIAL_ICONS = data.social;
export const MESSAGING_ICONS = data.messaging;
export const CONNECT_ICONS = data.connect;
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  data.platforms.map((platform) => [platform.icon, platform.name]),
);
export const WHITE_ICONS = new Set(data.whiteIcons);
