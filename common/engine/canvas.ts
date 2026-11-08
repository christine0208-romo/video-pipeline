import { configureEngine } from "../vendor/canvas-engine/engine.js";
import { COLORS, GRID, SAFE, TYPE, VIDEO } from "./tokens";

/**
 * 作品可以在启动时再调一次，覆盖 CONFIG（例如 CONFIG.SCENES / rail）。
 * 不传时用公共令牌的默认值——这样引擎调用方永远拿不到 undefined 尺寸。
 */
export const DEFAULT_CANVAS_CONFIG = {
  W: VIDEO.width,
  H: VIDEO.height,
  FPS: VIDEO.fps,
  COLORS,
  GRID,
  SAFE,
  TYPE: { zh: TYPE.zh, latin: TYPE.latin, mono: TYPE.mono },
  SCENES: [] as { id: string; start: number; end: number }[],
  rail: { left: "", right: "" },
};

configureEngine(DEFAULT_CANVAS_CONFIG);

export * from "../vendor/canvas-engine/engine.js";
