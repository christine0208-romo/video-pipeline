import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type Draw = (
  ctx: CanvasRenderingContext2D,
  t: number,
  frame: number,
) => void;

/**
 * 把逐帧 Canvas 绘制接进 Remotion。
 * 每次渲染整幅重绘，不保留跨帧状态 —— 这是可 seek 的前提。
 */
export const CanvasStage: React.FC<{
  draw: Draw;
  width: number;
  height: number;
  style?: React.CSSProperties;
  pixelRatio?: number;
}> = ({ draw, width, height, style, pixelRatio = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, frame / fps, frame);
  }, [draw, frame, fps, width, height, pixelRatio]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <canvas ref={ref} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
