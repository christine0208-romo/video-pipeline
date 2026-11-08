import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Check } from "lucide-react";
import { clamp01, springAt } from "../../../../engine";
import { BeatTransition } from "../shared";
import { FootageLayer, ImageLayer, ScreenshotLayer } from "../media";
import { GeneratedClip } from "../generated";
import type { ClipSpec, PackRendererProps, TransitionIn } from "../types";

const MEDIA = {
  mode: "dark" as const,
  bg: "#05080D",
  bg2: "#0E1724",
  text: "#F4F7FB",
  text2: "#A7B4C6",
  accent: "#3D8BFF",
  warn: "#FF5A4E",
  line: "rgba(255,255,255,0.14)",
};

type Props = {
  platform?: string;
  icon?: string;
  header?: "none" | "icon" | "name";
  endStyle?: "cta" | "statement" | "question" | "handle";
  handle?: string;
  clips?: ClipSpec[];
  title?: string;
  caption?: string;
  ctaLines?: string[];
  stamp?: string;
  disclaimer?: string;
};

function clipSeconds(clip: ClipSpec) {
  if (clip.duration) return Math.max(0.3, clip.duration);
  if (clip.in != null && clip.out != null) {
    return Math.max(0.3, (clip.out - clip.in) / (clip.speed ?? 1));
  }
  return null;
}

function layoutClips(clips: ClipSpec[], totalFrames: number, fps: number) {
  if (!clips.length) return [];
  const fixed = clips.map(clipSeconds);
  const autoCount = fixed.filter((x) => x == null).length;
  const fixedSum = fixed.reduce<number>((a, b) => a + (b ?? 0), 0);
  const auto = autoCount ? Math.max(0.4, (totalFrames / fps - fixedSum) / autoCount) : 0;
  const raw = fixed.map((x) => x ?? auto);
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const scale = totalFrames / fps / sum;
  const frames = raw.map((x) => Math.max(1, Math.round(x * scale * fps)));
  let acc = 0;
  const starts = frames.map((f) => {
    const s = acc;
    acc += f;
    return s;
  });
  const last = frames.length - 1;
  frames[last] = Math.max(1, totalFrames - starts[last]);
  return frames.map((f, i) => ({ from: starts[i], frames: f }));
}

const ClipView: React.FC<{ clip: ClipSpec; dur: number; globals: Props }> = ({
  clip,
  dur,
  globals,
}) => {
  if (clip.kind === "generated") {
    return (
      <GeneratedClip
        id={clip.generator!}
        dur={dur}
        props={{ platform: globals.platform, icon: globals.icon, ...clip.props }}
      />
    );
  }
  const media = clip.media;
  if (!media) return null;
  if (clip.kind === "screenshot" || media.kind === "screenshot") {
    return <ScreenshotLayer media={media} dur={dur} palette={MEDIA} />;
  }
  if (clip.kind === "image" || media.kind === "image") {
    return (
      <ImageLayer
        src={media.src ?? ""}
        dur={dur}
        focus={clip.focus ?? media.focus}
        fit="cover"
        palette={MEDIA}
      />
    );
  }
  return (
    <FootageLayer
      src={media.src ?? ""}
      inPoint={media.in ?? 0}
      dur={dur}
      sourceFps={30}
      speed={clip.speed ?? 1}
      focus={clip.focus ?? media.focus}
      motion={clip.motion ?? "push"}
      motionAmount={clip.motionAmount ?? 0.05}
      transitionIn="cut"
      palette={MEDIA}
      objectFit="cover"
    />
  );
};

const ClipFx: React.FC<{ type?: TransitionIn }> = ({ type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (type === "whip") {
    const p = Math.max(0, 1 - t / 0.22);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "#FFFFFF",
          opacity: p * 0.14,
          transform: `translateX(${(1 - p) * 36}%)`,
        }}
      />
    );
  }
  if (type === "flash") {
    const p = Math.max(0, 1 - t / 0.12);
    return <AbsoluteFill style={{ pointerEvents: "none", background: "#FFFFFF", opacity: p }} />;
  }
  if (type === "zoom" || type === "wipe") return <BeatTransition type={type} />;
  return null;
};

const Overlay: React.FC<{ props: Props; t: number; role: string }> = ({ props, t, role }) => {
  const p = clamp01((t - 0.08) / 0.4);
  const lines = props.ctaLines?.length ? props.ctaLines : [];
  const title = props.title ?? "";
  const titleSize = title.length > 12 ? 58 : title.length > 10 ? 64 : 78;
  const header = props.header ?? "name";
  const endStyle = props.endStyle ?? "cta";
  const endLines = lines.length ? lines : title ? [title] : [];
  const handle = props.handle ?? "主页看更多";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.48) 22%, rgba(0,0,0,0) 48%)",
        }}
      />
      {header !== "none" ? (
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 120,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: Math.min(1, p),
          }}
        >
          {props.icon ? (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
              }}
            >
              <Img
                src={staticFile(props.icon)}
                style={{ width: 38, height: 38, objectFit: "contain" }}
              />
            </div>
          ) : null}
          {header === "name" && props.platform ? (
            <span
              style={{
                fontFamily: '"JetBrains Mono"',
                fontSize: 24,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.82)",
              }}
            >
              {props.platform}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 140,
          bottom: 340,
          opacity: Math.min(1, p),
          transform: `translateY(${(1 - p) * 24}px)`,
        }}
      >
        {role !== "end" && props.title ? (
          <div
            style={{
              marginTop: 12,
              fontFamily: '"Noto Sans SC"',
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 1.08,
              color: "#FFFFFF",
              textShadow: "0 4px 24px rgba(0,0,0,0.35)",
            }}
          >
            {title}
          </div>
        ) : null}
        {role !== "end" && props.caption ? (
          <div
            style={{
              marginTop: 16,
              fontFamily: '"Noto Sans SC"',
              fontSize: 32,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {props.caption}
          </div>
        ) : null}
        {role === "end" ? (
          <div style={{ marginTop: 24 }}>
            {endStyle === "handle" ? (
              <div
                style={{
                  fontFamily: '"JetBrains Mono"',
                  fontSize: 22,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                {handle}
              </div>
            ) : endStyle === "question" ? (
              <>
                <div
                  style={{
                    fontFamily: '"Noto Sans SC"',
                    fontWeight: 900,
                    fontSize: 64,
                    lineHeight: 1.14,
                    color: "#FFFFFF",
                  }}
                >
                  {title}
                </div>
                {handle ? (
                  <div
                    style={{
                      marginTop: 18,
                      fontFamily: '"JetBrains Mono"',
                      fontSize: 20,
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {handle}
                  </div>
                ) : null}
              </>
            ) : endStyle === "statement" ? (
              <>
                {endLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: '"Noto Sans SC"',
                      fontWeight: 900,
                      fontSize: 72,
                      lineHeight: 1.14,
                      color: "#FFFFFF",
                      opacity: clamp01((t - 0.1 - i * 0.08) / 0.35),
                    }}
                  >
                    {line}
                  </div>
                ))}
                {handle ? (
                  <div
                    style={{
                      marginTop: 18,
                      fontFamily: '"JetBrains Mono"',
                      fontSize: 20,
                      color: "rgba(255,255,255,0.65)",
                    }}
                  >
                    {handle}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {endLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: '"Noto Sans SC"',
                      fontWeight: 900,
                      fontSize: 72,
                      lineHeight: 1.14,
                      color: "#FFFFFF",
                      opacity: clamp01((t - 0.1 - i * 0.08) / 0.35),
                    }}
                  >
                    {line}
                  </div>
                ))}
                <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      background: "#2F6FED",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={28} color="#FFFFFF" strokeWidth={3} />
                  </div>
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono"',
                      fontSize: 22,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {props.stamp ?? "主页了解"}
                  </span>
                </div>
              </>
            )}
            {props.disclaimer ? (
              <div
                style={{
                  marginTop: 18,
                  maxWidth: 780,
                  fontFamily: '"Noto Sans SC"',
                  fontSize: 20,
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {props.disclaimer}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const ClipRemix: React.FC<PackRendererProps> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const props = (beat.props ?? {}) as Props;
  const clips = props.clips ?? [];
  const totalFrames = Math.max(1, Math.round(beat.dur * fps));
  const layout = layoutClips(clips, totalFrames, fps);
  return (
    <AbsoluteFill style={{ background: "#05080D", overflow: "hidden" }}>
      {layout.length ? (
        layout.map((slot, i) => (
          <Sequence key={i} from={slot.from} durationInFrames={slot.frames}>
            <ClipView clip={clips[i]} dur={slot.frames / fps} globals={props} />
            <ClipFx type={clips[i].transitionIn} />
          </Sequence>
        ))
      ) : (
        <AbsoluteFill
          style={{
            background: "radial-gradient(60% 50% at 50% 40%, #142033, #05080D 72%)",
          }}
        />
      )}
      <Overlay props={props} t={t} role={beat.role} />
    </AbsoluteFill>
  );
};
