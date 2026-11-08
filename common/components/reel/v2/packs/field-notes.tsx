import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, springAt } from "../../../../engine";
import { NOTES, Kicker, Rich } from "../shared";
import { MediaView } from "../media";
import type { PackRendererProps } from "../types";

type NoteItem = { text: string; checked?: boolean };

type Props = {
  kicker?: string;
  title?: string;
  items?: NoteItem[];
  stamp?: string;
  cta?: string;
  ctaLines?: string[];
};

const Check: React.FC<{ p: number; color: string }> = ({ p, color }) => (
  <svg width="34" height="34" viewBox="0 0 34 34" style={{ overflow: "visible" }}>
    <path
      d="M6 18 L14 26 L29 8"
      fill="none"
      stroke={color}
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - clamp01(p)}
    />
  </svg>
);

const Stage: React.FC<{ props: Props; beat: PackRendererProps["beat"] }> = ({ props, beat }) => {
  const hasMedia = Boolean(beat.media);
  return (
    <AbsoluteFill style={{ background: NOTES.bg }}>
      {hasMedia ? (
        <MediaView
          media={beat.media!}
          dur={beat.dur}
          palette={NOTES}
          motion="push"
          motionAmount={0.045}
          grade={{ brightness: 1.05, saturation: 0.92 }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(250,247,239,0.8) 0%, rgba(250,247,239,0.4) 46%, rgba(250,247,239,0.08) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 47px, ${NOTES.line} 48px)`,
          opacity: 0.35,
        }}
      />
    </AbsoluteFill>
  );
};

const Stamp: React.FC<{ text?: string; at: number; t: number }> = ({ text, at, t }) => {
  if (!text) return null;
  const s = springAt(Math.max(0, t - at), { stiffness: 220, damping: 14 });
  return (
    <div
      style={{
        display: "inline-block",
        marginTop: 26,
        padding: "10px 18px",
        border: `4px solid ${NOTES.accent}`,
        color: NOTES.accent,
        fontFamily: NOTES.display,
        fontSize: 44,
        lineHeight: 1,
        transform: `rotate(-8deg) scale(${0.6 + 0.4 * s})`,
        opacity: Math.min(1, s),
      }}
    >
      {text}
    </div>
  );
};

export const FieldNotes: React.FC<PackRendererProps> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const props = (beat.props ?? {}) as Props;
  const items = props.items?.length ? props.items : beat.overlay ? [{ text: beat.overlay }] : [];

  if (beat.role === "end") {
    const lines = props.ctaLines?.length ? props.ctaLines : [props.cta ?? beat.overlay ?? ""];
    return (
      <AbsoluteFill>
        <Stage props={props} beat={beat} />
        <div style={{ position: "absolute", left: 80, right: 140, top: 720 }}>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: NOTES.display,
                fontSize: 92,
                lineHeight: 1.18,
                color: NOTES.text,
                opacity: clamp01((t - 0.1 - i * 0.1) / 0.35),
                transform: `translateY(${(1 - clamp01((t - 0.1 - i * 0.1) / 0.35)) * 26}px)`,
              }}
            >
              {line}
            </div>
          ))}
          <div
            style={{
              marginTop: 26,
              height: 5,
              width: `${clamp01((t - 0.2) / 0.6) * 360}px`,
              background: NOTES.accent,
            }}
          />
          <Stamp text={props.stamp ?? "主页了解"} at={0.5} t={t} />
        </div>
      </AbsoluteFill>
    );
  }

  if (beat.role === "hook") {
    return (
      <AbsoluteFill>
        <Stage props={props} beat={beat} />
        <div style={{ position: "absolute", left: 80, right: 140, top: 420 }}>
          <Kicker text={props.kicker} theme={NOTES} t={t} />
          <div
            style={{
              marginTop: 16,
              fontFamily: NOTES.display,
              fontSize: 118,
              lineHeight: 1.05,
              color: NOTES.text,
              letterSpacing: 2,
            }}
          >
            <Rich text={props.title ?? beat.overlay ?? ""} theme={NOTES} t={t} />
          </div>
          <div
            style={{
              marginTop: 24,
              height: 6,
              width: `${clamp01((t - 0.2) / 0.6) * 420}px`,
              background: NOTES.accent,
              transform: "rotate(-1deg)",
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Stage props={props} beat={beat} />
      <div style={{ position: "absolute", left: 80, top: 330, width: 620 }}>
        <Kicker text={props.kicker} theme={NOTES} t={t} />
        <div
          style={{
            marginTop: 12,
            fontFamily: NOTES.display,
            fontSize: 72,
            lineHeight: 1.1,
            color: NOTES.text,
          }}
        >
          {props.title ?? ""}
        </div>
        <div style={{ marginTop: 30 }}>
          {items.slice(0, 4).map((item, i) => {
            const at = 0.18 + i * 0.22;
            const p = clamp01((t - at) / 0.35);
            return (
              <div
                key={`${item.text}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 20,
                  opacity: Math.min(1, p),
                  transform: `translateX(${(1 - p) * -22}px)`,
                }}
              >
                <Check p={(t - at - 0.12) / 0.3} color={NOTES.accent} />
                <span
                  style={{
                    fontFamily: NOTES.display,
                    fontSize: 50,
                    lineHeight: 1.2,
                    color: NOTES.text,
                  }}
                >
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
        <Stamp text={props.stamp} at={0.4 + items.length * 0.18} t={t} />
      </div>
    </AbsoluteFill>
  );
};
