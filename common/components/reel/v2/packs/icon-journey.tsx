import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Check, X } from "lucide-react";
import { clamp01, easeOutCubic, springAt } from "../../../../engine";
import { JOURNEY } from "../shared";
import { MediaFrame, ScreenshotLayer } from "../media";
import type { MediaRef, PackRendererProps } from "../types";

type Stage = "icon" | "requirement" | "failure" | "product" | "success" | "end";

type Props = {
  icon?: string;
  platform?: string;
  stage?: Stage;
  kicker?: string;
  title?: string;
  caption?: string;
  cta?: string;
  ctaLines?: string[];
  stamp?: string;
};

const stageOf = (props: Props, role: string): Stage => {
  if (props.stage) return props.stage;
  if (role === "hook") return "icon";
  if (role === "end") return "end";
  return "product";
};

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: JOURNEY.bg }}>
    <AbsoluteFill
      style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0px, transparent 47px, ${JOURNEY.line} 48px)`,
        opacity: 0.28,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 980,
        background: `radial-gradient(58% 48% at 50% 38%, ${JOURNEY.accent}16 0%, transparent 72%)`,
      }}
    />
  </AbsoluteFill>
);

const IconBadge: React.FC<{
  icon?: string;
  size: number;
  t: number;
  style?: React.CSSProperties;
}> = ({ icon, size, t, style }) => {
  const p = springAt(Math.max(0, t - 0.05), { stiffness: 180, damping: 18 });
  const float = Math.sin(t * 1.4) * (size * 0.012);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "#FFFFFF",
        border: `1px solid ${JOURNEY.line}`,
        boxShadow:
          size > 120 ? "0 24px 60px rgba(29,35,42,0.16)" : "0 10px 28px rgba(29,35,42,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${(1 - p) * 18 + float}px) scale(${0.86 + 0.14 * p})`,
        opacity: Math.min(1, p),
        ...style,
      }}
    >
      {icon ? (
        <Img
          src={staticFile(icon)}
          style={{ width: size * 0.56, height: size * 0.56, objectFit: "contain" }}
        />
      ) : null}
    </div>
  );
};

const StageMark: React.FC<{ stage: Stage; t: number }> = ({ stage, t }) => {
  if (stage !== "failure" && stage !== "success") return null;
  const p = springAt(Math.max(0, t - 0.32), { stiffness: 220, damping: 12 });
  const ok = stage === "success";
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: -14,
        width: 104,
        height: 104,
        borderRadius: 52,
        background: ok ? JOURNEY.accent : JOURNEY.accent2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: ok
          ? "0 12px 30px rgba(47,111,237,0.35)"
          : "0 12px 30px rgba(217,85,63,0.35)",
        transform: `scale(${0.55 + 0.45 * p}) rotate(${(1 - p) * -12}deg)`,
        opacity: Math.min(1, p),
      }}
    >
      {ok ? (
        <Check size={58} color="#FFFFFF" strokeWidth={3.2} />
      ) : (
        <X size={58} color="#FFFFFF" strokeWidth={3.2} />
      )}
    </div>
  );
};

const Evidence: React.FC<{ media?: MediaRef; dur: number; t: number }> = ({ media, dur, t }) => {
  if (!media) return null;
  const p = springAt(Math.max(0, t - 0.08), { stiffness: 150, damping: 20 });
  const wrap: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    opacity: Math.min(1, p),
    transform: `translateY(${(1 - p) * 36}px) scale(${0.97 + 0.03 * p})`,
  };
  if (media.kind === "screenshot") {
    return (
      <div style={wrap}>
        <ScreenshotLayer media={media} dur={dur} palette={JOURNEY} />
      </div>
    );
  }
  if (media.kind === "ui") {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 430 }}>
          <MediaFrame
            media={media}
            dur={dur}
            palette={JOURNEY}
            ratio="9 / 16"
            style={{ borderRadius: 30 }}
          />
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%" }}>
        <MediaFrame
          media={media}
          dur={dur}
          palette={JOURNEY}
          ratio="16 / 10"
          style={{ borderRadius: 18 }}
        />
      </div>
    </div>
  );
};

const Header: React.FC<{ props: Props; t: number }> = ({ props, t }) => (
  <div
    style={{
      position: "absolute",
      left: 72,
      top: 160,
      display: "flex",
      alignItems: "center",
      gap: 20,
    }}
  >
    <IconBadge icon={props.icon} size={92} t={t} />
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontFamily: JOURNEY.mono,
          fontSize: 20,
          letterSpacing: "0.16em",
          color: JOURNEY.text2,
        }}
      >
        {props.platform ?? ""}
      </div>
      {props.kicker ? (
        <div
          style={{
            fontFamily: JOURNEY.display,
            fontWeight: 900,
            fontSize: 34,
            color: JOURNEY.text,
          }}
        >
          {props.kicker}
        </div>
      ) : null}
    </div>
  </div>
);

export const IconJourney: React.FC<PackRendererProps> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const props = (beat.props ?? {}) as Props;
  const stage = stageOf(props, beat.role);
  const title = props.title ?? beat.overlay ?? "";

  if (stage === "icon") {
    const exit = clamp01((t - (beat.dur - 0.5)) / 0.5);
    const e = easeOutCubic(exit);
    const size = 236 + (92 - 236) * e;
    const left = (1080 - 236) / 2 + (72 - (1080 - 236) / 2) * e;
    const top = 560 + (160 - 560) * e;
    const copy = 1 - e;
    return (
      <AbsoluteFill>
        <Background />
        <div style={{ position: "absolute", left, top }}>
          <IconBadge icon={props.icon} size={size} t={t} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 140,
            top: 880,
            opacity: copy,
            transform: `translateY(${e * 30}px)`,
          }}
        >
          <div
            style={{
              fontFamily: JOURNEY.mono,
              fontSize: 24,
              letterSpacing: "0.2em",
              color: JOURNEY.accent,
            }}
          >
            {props.platform ?? ""}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: JOURNEY.display,
              fontWeight: 900,
              fontSize: 86,
              lineHeight: 1.06,
              color: JOURNEY.text,
            }}
          >
            {title}
          </div>
          {props.kicker ? (
            <div
              style={{
                marginTop: 18,
                fontFamily: JOURNEY.body,
                fontSize: 32,
                color: JOURNEY.text2,
              }}
            >
              {props.kicker}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    );
  }

  if (stage === "end") {
    const lines = props.ctaLines?.length ? props.ctaLines : [props.cta ?? beat.overlay ?? ""];
    return (
      <AbsoluteFill>
        <Background />
        <Header props={props} t={t} />
        <div style={{ position: "absolute", left: 72, right: 140, top: 680 }}>
          {lines.map((line, i) => {
            const q = clamp01((t - 0.1 - i * 0.1) / 0.4);
            return (
              <div
                key={i}
                style={{
                  fontFamily: JOURNEY.display,
                  fontWeight: 900,
                  fontSize: 86,
                  lineHeight: 1.16,
                  color: JOURNEY.text,
                  opacity: q,
                  transform: `translateY(${(1 - q) * 28}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: clamp01((t - 0.5) / 0.4),
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                background: JOURNEY.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={30} color="#FFFFFF" strokeWidth={3} />
            </div>
            <span style={{ fontFamily: JOURNEY.mono, fontSize: 22, color: JOURNEY.text2 }}>
              {props.stamp ?? "主页了解"}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <Background />
      <Header props={props} t={t} />
      <div style={{ position: "absolute", left: 72, right: 140, top: 330, height: 760 }}>
        <Evidence media={beat.media} dur={beat.dur} t={t} />
        <StageMark stage={stage} t={t} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 140,
          top: 1150,
          opacity: clamp01((t - 0.12) / 0.4),
        }}
      >
        <div
          style={{
            fontFamily: JOURNEY.display,
            fontWeight: 900,
            fontSize: 68,
            lineHeight: 1.12,
            color: stage === "failure" ? JOURNEY.accent2 : JOURNEY.text,
          }}
        >
          {title}
        </div>
        {props.caption ? (
          <div
            style={{
              marginTop: 16,
              fontFamily: JOURNEY.body,
              fontSize: 31,
              lineHeight: 1.45,
              color: JOURNEY.text2,
            }}
          >
            {props.caption}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
