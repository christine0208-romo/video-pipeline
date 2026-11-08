import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export type ShaderUniforms = Record<string, number>;

/**
 * 逐帧重绘的 WebGL2 全屏层。只由 frame/fps 驱动，无跨帧状态，可 seek。
 * scale < 1 时以更低分辨率渲染再拉伸——软背景看不出差别，渲染快数倍。
 */
export const ShaderStage: React.FC<{
  fragment: string;
  uniforms?: ShaderUniforms;
  width: number;
  height: number;
  scale?: number;
  style?: React.CSSProperties;
}> = ({ fragment, uniforms = {}, width, height, scale = 0.5, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const locationsRef = useRef<Map<string, WebGLUniformLocation | null>>(new Map());
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const uniformKey = JSON.stringify(uniforms);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      console.error("ShaderStage: WebGL2 unavailable, layer left empty");
      return;
    }

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("ShaderStage: createShader failed");
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`ShaderStage: ${gl.getShaderInfoLog(shader) ?? "compile failed"}`);
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!program) throw new Error("ShaderStage: createProgram failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`ShaderStage: ${gl.getProgramInfoLog(program) ?? "link failed"}`);
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    glRef.current = gl;
    programRef.current = program;
    locationsRef.current.clear();

    return () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      glRef.current = null;
      programRef.current = null;
    };
  }, [fragment, width, height, scale]);

  useLayoutEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas) return;

    const location = (name: string) => {
      const cache = locationsRef.current;
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name) ?? null;
    };

    const resolution = location("u_resolution");
    if (resolution) gl.uniform2f(resolution, canvas.width, canvas.height);
    const time = location("u_time");
    if (time) gl.uniform1f(time, frame / fps);
    const frameUniform = location("u_frame");
    if (frameUniform) gl.uniform1f(frameUniform, frame);
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = location(name);
      if (loc) gl.uniform1f(loc, value);
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, fps, uniformKey, uniforms]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
