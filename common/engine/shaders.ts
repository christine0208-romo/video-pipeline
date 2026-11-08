/**
 * GLSL ES 3.00 片段着色器。约定 uniform：
 *   u_resolution (vec2)、u_time (float, 秒)、u_frame (float)
 * 其余按需在 ShaderStage 的 uniforms 里传。
 */

export const WORLD_FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_warm;
uniform float u_zoom;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - vec2(0.5 * u_resolution.x, 0.44 * u_resolution.y)) / u_resolution.y;
  p *= u_zoom;
  float t = u_time;

  float r = length(p);
  float a = atan(p.y, p.x);

  float n1 = fbm(p * 2.0 + vec2(t * 0.08, -t * 0.05));
  float n2 = fbm(p * 4.2 - vec2(t * 0.13, t * 0.09) + n1 * 1.6);
  float n3 = fbm(p * 8.0 + vec2(-t * 0.21, t * 0.16));

  // 用噪声扭曲极角，让光束不规则
  float aw = a + n1 * 3.4 + sin(t * 0.24) * 0.5;
  float rays = sin(aw * 5.0 + n2 * 2.2) * 0.5 + 0.5;
  rays = pow(rays, 5.0) * smoothstep(1.15, 0.04, r);
  rays *= 0.45 + 0.55 * n2;

  float core = exp(-r * 5.0);

  vec3 deep = vec3(0.006, 0.012, 0.024);
  vec3 blue = vec3(0.08, 0.30, 0.58);
  vec3 teal = vec3(0.02, 0.42, 0.50);
  vec3 gold = vec3(1.00, 0.66, 0.12);

  vec3 col = deep;
  col = mix(col, blue, smoothstep(0.10, 0.95, n1) * 0.40);
  col += teal * pow(n3, 2.0) * 0.09;
  col += blue * core * 0.42;
  col += gold * rays * u_warm * 0.15;

  // 向外扩散的星流带
  float travel = smoothstep(0.0, 1.0, fract(r * 1.9 - t * 0.42));
  col += blue * travel * smoothstep(1.1, 0.2, r) * 0.05;

  col *= smoothstep(1.35, 0.10, r);
  col *= 0.90;

  float scan = 0.990 + 0.010 * sin(gl_FragCoord.y * 1.7 + t * 2.0);
  col *= scan;
  col += (hash(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 0.028;

  outColor = vec4(max(col, 0.0), 1.0);
}
`;
