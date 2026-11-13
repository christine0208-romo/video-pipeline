import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01 } from "../../platform";
import { paletteOf, type Palette } from "../palette";
import type { PresetProps } from "../types";
import { Backdrop } from "./backdrop";
import { easeOutExpo } from "./easing";

const textStyle = (
  palette: Palette,
  fontSize: number,
  fontWeight: number,
  lineHeight = 1.15,
  letterSpacing = 0.02,
): React.CSSProperties => ({
  fontFamily: '"Noto Sans SC"',
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing: `${letterSpacing}em`,
  color: palette.text,
  textShadow: "0 6px 30px rgba(0,0,0,0.55)",
});

const justifyFor = (
  align?: string,
): React.CSSProperties["justifyContent"] =>
  align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

const splitLines = (text: string) => {
  let offset = 0;
  return text.split("\n").map((line) => {
    const chars = Array.from(line);
    const start = offset;
    offset += chars.length;
    return { chars, start };
  });
};

const CharRise: React.FC<{
  text: string;
  palette: Palette;
  fontSize: number;
  fontWeight: number;
  distanceEm: number;
  staggerFrames: number;
  align?: string;
  lineHeight?: number;
  letterSpacing?: number;
}> = ({
  text,
  palette,
  fontSize,
  fontWeight,
  distanceEm,
  staggerFrames,
  align,
  lineHeight,
  letterSpacing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = splitLines(text);
  return (
    <div
      style={{
        ...textStyle(palette, fontSize, fontWeight, lineHeight, letterSpacing),
        display: "flex",
        flexDirection: "column",
        gap: fontSize * 0.08,
      }}
    >
      {lines.map((line, lineIndex) => (
        <div
          key={lineIndex}
          style={{
            display: "flex",
            justifyContent: justifyFor(align),
            flexWrap: "wrap",
          }}
        >
          {line.chars.map((char, charIndex) => {
            const index = line.start + charIndex;
            const p = clamp01((frame - index * staggerFrames) / (16 / fps));
            const eased = easeOutExpo(p);
            return (
              <span
                key={`${lineIndex}-${charIndex}`}
                style={{
                  display: "inline-block",
                  opacity: eased,
                  transform: `translateY(${(1 - eased) * fontSize * distanceEm}px)`,
                }}
              >
                {char === " " ? " " : char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const Typewriter: React.FC<{
  text: string;
  palette: Palette;
  fontSize: number;
  fontWeight: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
}> = ({ text, palette, fontSize, fontWeight, align, lineHeight, letterSpacing }) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  const visible = Math.min(chars.length, Math.floor(frame / 2));
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  return (
    <div
      style={{
        ...textStyle(palette, fontSize, fontWeight, lineHeight, letterSpacing),
        whiteSpace: "pre-wrap",
        width: "100%",
        textAlign: align ?? "left",
      }}
    >
      {chars.slice(0, visible).join("")}
      <span
        style={{
          display: "inline-block",
          width: "0.08em",
          opacity: cursorOn && visible < chars.length ? 1 : 0,
          color: palette.accent,
        }}
      >
        |
      </span>
    </div>
  );
};

const KeywordHighlight: React.FC<{
  text: string;
  keyword?: string;
  palette: Palette;
  fontSize: number;
  fontWeight: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
}> = ({ text, keyword, palette, fontSize, fontWeight, align, lineHeight, letterSpacing }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const query = keyword?.trim() ?? "";
  const index = query ? text.indexOf(query) : -1;
  const before = index >= 0 ? text.slice(0, index) : text;
  const key = index >= 0 ? text.slice(index, index + query.length) : "";
  const after = index >= 0 ? text.slice(index + query.length) : "";
  const p = clamp01((frame - Math.round(fps * 0.4)) / (10 / fps));
  const eased = easeOutExpo(p);
  return (
    <div
      style={{
        ...textStyle(palette, fontSize, fontWeight, lineHeight, letterSpacing),
        textAlign: align ?? "center",
      }}
    >
      <span>{before}</span>
      {key ? (
        <span style={{ position: "relative", display: "inline-block", padding: "0 0.08em" }}>
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "10%",
              bottom: "10%",
              background: palette.accent,
              transform: `scaleX(${eased})`,
              transformOrigin: "left",
            }}
          />
          <span
            style={{
              position: "relative",
              color: eased > 0.55 ? palette.bg : palette.text,
            }}
          >
            {key}
          </span>
        </span>
      ) : null}
      <span>{after}</span>
    </div>
  );
};

const formatNumber = (value: number) =>
  Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const CountUp: React.FC<{
  from: number;
  to: number;
  prefix: string;
  suffix: string;
  palette: Palette;
  fontSize: number;
  fontWeight: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
}> = ({
  from,
  to,
  prefix,
  suffix,
  palette,
  fontSize,
  fontWeight,
  align,
  lineHeight,
  letterSpacing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clamp01(frame / (30 / fps));
  const value = from + (to - from) * easeOutExpo(p);
  const settle = Math.max(0, 1 - Math.abs(frame - 30) / 8);
  return (
    <div
      style={{
        ...textStyle(palette, fontSize, fontWeight, lineHeight, letterSpacing),
        fontVariantNumeric: "tabular-nums",
        textAlign: align ?? "center",
        transform: `scale(${1 + 0.06 * settle})`,
      }}
    >
      {prefix}
      {formatNumber(value)}
      {suffix}
    </div>
  );
};

export const TextAtom: React.FC<PresetProps> = ({
  alpha,
  palette = "aurora",
  code = "T01",
  text = "连接，从这里开始",
  keyword,
  fontSize = 96,
  fontWeight = 900,
  distanceEm = 0.6,
  staggerFrames = 1.5,
  countFrom = 0,
  countTo = 100,
  prefix = "",
  suffix = "",
  align = "center",
  vertical = "center",
  maxWidth = 920,
  lineHeight = 1.15,
  letterSpacing = 0.02,
  background,
  light = "center",
}) => {
  const p = paletteOf(palette);
  const backdrop = background ?? (alpha ? "none" : "glow");
  const justifyContent =
    vertical === "top"
      ? "flex-start"
      : vertical === "bottom"
        ? "flex-end"
        : "center";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: alpha ? "transparent" : p.bg,
        overflow: "hidden",
        fontFamily: '"Noto Sans SC"',
      }}
    >
      <Backdrop palette={p} background={backdrop} light={light} alpha={alpha} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent,
          padding: "120px 80px 220px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth,
            textAlign: align,
          }}
        >
          {code === "T01" ? (
            <CharRise
              text={text}
              palette={p}
              fontSize={fontSize}
              fontWeight={fontWeight}
              distanceEm={distanceEm}
              staggerFrames={staggerFrames}
              align={align}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
            />
          ) : null}
          {code === "T03" ? (
            <Typewriter
              text={text}
              palette={p}
              fontSize={fontSize}
              fontWeight={fontWeight}
              align={align}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
            />
          ) : null}
          {code === "T06" ? (
            <KeywordHighlight
              text={text}
              keyword={keyword}
              palette={p}
              fontSize={fontSize}
              fontWeight={fontWeight}
              align={align}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
            />
          ) : null}
          {code === "T08" ? (
            <CountUp
              from={countFrom}
              to={countTo}
              prefix={prefix}
              suffix={suffix}
              palette={p}
              fontSize={fontSize}
              fontWeight={fontWeight}
              align={align}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
            />
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
