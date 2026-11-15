# common/engine

核心运行时原语，不含任何创意实现或项目设计令牌。

- `motion.ts` / `motion-core.mjs`：运动数学（clamp、缓动、keyedRandom、springAt、相机与构图工具）。
- `time.ts`：时间工具（clamp01、frameAt、frameRange、schedule 等）。
- `fonts.ts`：`useFonts` 字体门与 `measureCN`；字体清单由内容包提供。
- `CanvasStage.tsx` / `ShaderStage.tsx` / `shaders.ts`：Remotion 与 Canvas/WebGL 的通用桥。
- `assets.ts`：`assetPath()`，把相对素材路径规范成 public URL。
- `easing.ts`：缓动曲线。
