import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, springAt } from "../../../../engine";
import { BROADCAST, Kicker, Rich } from "../shared";
import { MediaFrame } from "../media";
import type { MediaRef, PackRendererProps } from "../types";

type Side = {
  title: string;
  points: string[];
  media?: MediaRef;
  tag?: string;
};

type Props = {
  kicker?: string;
  title?: string;
  left?: Side;
  right?: Side;
  active?: number;
  round?: string;
  cta?: string;
  ctaLines?: string[];
};

const Stage: React.FC<{ dim?: number }> = ({ dim = 0 }) => (
  <AbsoluteFill style={{ background: BROADCAST.bg }}>
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(90deg, rgba(255,77,61,0.16) 0%, rgba(7,11,18,0) 42%, rgba(7,11,18,0) 58%, rgba(61,139,255,0.16) 100%)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${BROADCAST.line} 1px, transparent 1px)`,
        backgroundSize: "100% 64px",
        opacity: 0.5,
      }}
    />
    <AbsoluteFill
      style={{
        background: "radial-gradient(80% 60% at 50% 40%, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.4) 100%)",
      }}
    />
    {dim > 0 ? <AbsoluteFill style={{ background: `rgba(4,7,12,${dim})` }} /> : null}
  </AbsoluteFill>
);

const Panel: React.FC<{
  side?: Side;
  index: number;
  active: boolean;
  dur: number;
  t: number;
  align: "left" | "right";
}> = ({ side, index, active, dur, t, align }) => {
  if (!side) return null;
  const s = springAt(Math.max(0, t - (0.04 + index * 0.08)), { stiffness: 120, damping: 19 });
  const color = index === 0 ? BROADCAST.accent : BROADCAST.accent2;
  return (
    <div
      style={{
        position: "absolute",
        top: 400,
        height: 900,
        width: 448,
        left: align === "left" ? 64 : 568,
        padding: "26px 24px",
        borderRadius: 18,
        background: BROADCAST.panel,
        border: `2px solid ${active ? color : BROADCAST.line}`,
        boxShadow: active ? `0 0 46px ${color}33` : "none",
        opacity: Math.min(1, 0.34 + (active ? 0.66 : 0.12) * s),
        transform: `translateX(${(1 - s) * (align === "left" ? -70 : 70)}px)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: BROADCAST.mono, fontSize: 18, color }}>{side.tag ?? (index === 0 ? "A" : "B")}</span>
        <span style={{ fontFamily: BROADCAST.mono, fontSize: 16, color: active ? color : BROADCAST.text3 }}>
          {active ? "ON AIR" : "HOLD"}
        </span>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: side.title.length > 4 ? 46 : 54,
          fontWeight: 900,
          lineHeight: 1.12,
          color: active ? BROADCAST.text : BROADCAST.text2,
        }}
      >
        {side.title}
      </div>
      <MediaFrame
        media={side.media}
        dur={dur}
        palette={BROADCAST}
        ratio="4 / 3"
        motion="push"
        motionAmount={0.045}
        style={{ marginTop: 18 }}
      />
      <div style={{ marginTop: 20 }}>
        {side.points.slice(0, 3).map((point, j) => (
          <div
            key={j}
            style={{
              marginTop: 14,
              fontSize: 29,
              lineHeight: 1.35,
              color: active ? BROADCAST.text : BROADCAST.text2,
            }}
          >
            — {point}
          </div>
        ))}
      </div>
    </div>
  );
};

const Versus: React.FC<{ round?: string; t: number }> = ({ round, t }) => {
  const s = springAt(Math.max(0, t - 0.12), { stiffness: 170, damping: 16 });
  return (
    <div
      style={{
        position: "absolute",
        left: 515,
        top: 760,
        width: 50,
        height: 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${0.7 + 0.3 * s})`,
        opacity: Math.min(1, s),
      }}
    >
      <div style={{ width: 1, flex: 1, background: BROADCAST.line }} />
      <div
        style={{
          margin: "12px 0",
          fontFamily: BROADCAST.display,
          fontSize: 34,
          fontWeight: 900,
          color: BROADCAST.warn,
          border: `1px solid ${BROADCAST.warn}88`,
          borderRadius: 999,
          padding: "6px 12px",
        }}
      >
        VS
      </div>
      <div style={{ fontFamily: BROADCAST.mono, fontSize: 16, color: BROADCAST.text3 }}>
        {round ?? "01"}
      </div>
      <div style={{ width: 1, flex: 1, background: BROADCAST.line }} />
    </div>
  );
};

export const SplitDebate: React.FC<PackRendererProps> = ({ beat, edl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const props = (beat.props ?? {}) as Props;
  const active = Number(props.active ?? 0);

  if (beat.role === "hook") {
    return (
      <AbsoluteFill>
        <Stage />
        <div style={{ position: "absolute", left: 64, right: 120, top: 220 }}>
          <Kicker text={props.kicker} theme={BROADCAST} t={t} />
          <div
            style={{
              marginTop: 16,
              fontFamily: BROADCAST.display,
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: -3,
              color: BROADCAST.text,
            }}
          >
            <Rich text={props.title ?? beat.overlay ?? ""} theme={BROADCAST} t={t} />
          </div>
        </div>
        <Panel side={props.left} index={0} active dur={beat.dur} t={t} align="left" />
        <Panel side={props.right} index={1} active dur={beat.dur} t={t} align="right" />
        <Versus round="VS" t={t} />
      </AbsoluteFill>
    );
  }

  if (beat.role === "end") {
    return (
      <AbsoluteFill>
        <Stage dim={0.58} />
        <Panel side={props.left} index={0} active={false} dur={beat.dur} t={t} align="left" />
        <Panel side={props.right} index={1} active={false} dur={beat.dur} t={t} align="right" />
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 120,
            top: 760,
            textAlign: "center",
          }}
        >
          {(props.ctaLines?.length ? props.ctaLines : [props.cta ?? beat.overlay ?? ""]).map(
            (line, i) => (
              <div
                key={i}
                style={{
                  fontFamily: BROADCAST.display,
                  fontSize: 62,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  letterSpacing: -2,
                  color: BROADCAST.text,
                }}
              >
                {line}
              </div>
            ),
          )}
          <div
            style={{
              margin: "34px auto 0",
              height: 6,
              width: `${clamp01((t - 0.2) / 0.6) * 320}px`,
              background: BROADCAST.accent,
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Stage />
      <div style={{ position: "absolute", left: 64, right: 120, top: 220 }}>
        <Kicker text={props.kicker} theme={BROADCAST} t={t} />
        <div
          style={{
            marginTop: 10,
            fontFamily: BROADCAST.display,
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: -1,
            color: BROADCAST.text,
          }}
        >
          {props.title ?? ""}
        </div>
      </div>
      <Panel side={props.left} index={0} active={active === 0} dur={beat.dur} t={t} align="left" />
      <Panel side={props.right} index={1} active={active === 1} dur={beat.dur} t={t} align="right" />
      <Versus round={props.round} t={t} />
    </AbsoluteFill>
  );
};
