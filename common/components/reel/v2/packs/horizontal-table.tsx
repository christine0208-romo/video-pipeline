import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, springAt } from "../../../../engine";
import { Kicker, PAPER, Rich } from "../shared";
import { MediaFrame } from "../media";
import type { MediaRef, PackRendererProps } from "../types";

type TableType = {
  title: string;
  pros: string[];
  cons: string[];
  media?: MediaRef;
};

type Props = {
  kicker?: string;
  title?: string;
  types?: TableType[];
  focus?: number;
  cta?: string;
  ctaLines?: string[];
};

const CARD_W = 620;
const GAP = 40;
const STEP = CARD_W + GAP;

const Stage: React.FC<{ dim?: number }> = ({ dim = 0 }) => (
  <AbsoluteFill style={{ background: PAPER.bg }}>
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${PAPER.line} 1px, transparent 1px), linear-gradient(90deg, ${PAPER.line} 1px, transparent 1px)`,
        backgroundSize: "54px 54px",
        opacity: 0.32,
      }}
    />
    <AbsoluteFill
      style={{
        background: "radial-gradient(90% 70% at 50% 38%, rgba(255,255,255,0.55) 0%, rgba(36,34,29,0.12) 100%)",
      }}
    />
    {dim > 0 ? <AbsoluteFill style={{ background: `rgba(20,18,15,${dim})` }} /> : null}
  </AbsoluteFill>
);

const Board: React.FC<{
  types: TableType[];
  focus: number;
  dur: number;
  t: number;
  top: number;
  dim?: number;
}> = ({ types, focus, dur, t, top, dim = 0 }) => {
  const s = springAt(Math.max(0, t - 0.02), { stiffness: 110, damping: 20 });
  const left = 540 - CARD_W / 2 - focus * STEP + (1 - s) * 60;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, height: 1120, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left,
          top: 0,
          display: "flex",
          gap: GAP,
          alignItems: "flex-start",
        }}
      >
        {types.map((type, i) => {
          const active = Math.round(focus) === i;
          return (
            <div
              key={`${type.title}-${i}`}
              style={{
                width: CARD_W,
                minHeight: 1010,
                borderRadius: 22,
                background: PAPER.panel,
                border: `1px solid ${active ? PAPER.accent : PAPER.line}`,
                boxShadow: active
                  ? "0 26px 60px rgba(36,34,29,0.22)"
                  : "0 14px 34px rgba(36,34,29,0.10)",
                opacity: active ? 1 : Math.max(0.42, 0.9 - Math.abs(focus - i) * 0.22),
                transform: `translateY(${active ? -8 * s : 0}px)`,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "26px 24px 30px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: PAPER.mono, fontSize: 20, color: PAPER.accent }}>0{i + 1}</span>
                  <span style={{ fontFamily: PAPER.mono, fontSize: 16, color: PAPER.text3 }}>
                    {active ? "CURRENT" : "STANDBY"}
                  </span>
                </div>
                <MediaFrame
                  media={type.media}
                  dur={dur}
                  palette={PAPER}
                  ratio="16 / 10"
                  motion="push"
                  motionAmount={0.04}
                  style={{ marginTop: 16 }}
                />
                <div
                  style={{
                    marginTop: 22,
                    fontSize: type.title.length > 5 ? 42 : 50,
                    fontWeight: 900,
                    lineHeight: 1.15,
                    color: PAPER.text,
                  }}
                >
                  {type.title}
                </div>
                <div style={{ marginTop: 20, fontFamily: PAPER.mono, fontSize: 18, color: PAPER.accent }}>
                  优点
                </div>
                {type.pros.slice(0, 2).map((x, j) => (
                  <div key={`p${j}`} style={{ marginTop: 10, fontSize: 26, lineHeight: 1.3, color: PAPER.text }}>
                    + {x}
                  </div>
                ))}
                <div style={{ marginTop: 18, fontFamily: PAPER.mono, fontSize: 18, color: PAPER.warn }}>
                  缺点
                </div>
                {type.cons.slice(0, 2).map((x, j) => (
                  <div key={`c${j}`} style={{ marginTop: 10, fontSize: 26, lineHeight: 1.3, color: PAPER.text2 }}>
                    − {x}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {dim > 0 ? <AbsoluteFill style={{ background: `rgba(20,18,15,${dim})` }} /> : null}
    </div>
  );
};

export const HorizontalTable: React.FC<PackRendererProps> = ({ beat, edl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const props = (beat.props ?? {}) as Props;
  const types = props.types ?? [];
  const focus = Number(props.focus ?? 0);
  const dim = clamp01((t - 0.6) / 0.8) * 0.18;

  if (beat.role === "hook") {
    return (
      <AbsoluteFill>
        <Stage />
        <div style={{ position: "absolute", left: 64, right: 120, top: 220 }}>
          <Kicker text={props.kicker} theme={PAPER} t={t} />
          <div
            style={{
              marginTop: 18,
              fontFamily: PAPER.display,
              fontSize: 74,
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: -3,
              color: PAPER.text,
            }}
          >
            <Rich text={props.title ?? beat.overlay ?? ""} theme={PAPER} t={t} />
          </div>
          <div style={{ marginTop: 20, height: 6, width: `${clamp01(t / 0.6) * 240}px`, background: PAPER.accent }} />
        </div>
        <Board types={types} focus={0} dur={beat.dur} t={t} top={640} />
      </AbsoluteFill>
    );
  }

  if (beat.role === "end") {
    return (
      <AbsoluteFill>
        <Stage dim={0.42} />
        <Board
          types={types}
          focus={props.focus ?? 2}
          dur={beat.dur}
          t={t}
          top={300}
          dim={0.35}
        />
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 120,
            bottom: 260,
            padding: "34px 32px",
            background: "rgba(20,18,15,0.88)",
            borderLeft: `6px solid ${PAPER.accent}`,
          }}
        >
          {(props.ctaLines?.length ? props.ctaLines : [props.cta ?? beat.overlay ?? ""]).map(
            (line, i) => (
              <div
                key={i}
                style={{
                  fontFamily: PAPER.display,
                  fontSize: 62,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  color: "#F8F3E8",
                  letterSpacing: -2,
                }}
              >
                {line}
              </div>
            ),
          )}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Stage />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 120,
          top: 240,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <Kicker text={props.kicker} theme={PAPER} t={t} />
          <div
            style={{
              marginTop: 10,
              fontFamily: PAPER.display,
              fontSize: 46,
              fontWeight: 900,
              color: PAPER.text,
              letterSpacing: -1,
            }}
          >
            {props.title ?? ""}
          </div>
        </div>
        <div style={{ fontFamily: PAPER.mono, fontSize: 22, color: PAPER.text2 }}>
          {String(Math.round(focus) + 1).padStart(2, "0")} / {String(types.length).padStart(2, "0")}
        </div>
      </div>
      <div style={{ position: "absolute", left: 64, right: 120, top: 400, height: 2, background: PAPER.line }} />
      <Board types={types} focus={focus} dur={beat.dur} t={t} top={450} dim={dim} />
    </AbsoluteFill>
  );
};
