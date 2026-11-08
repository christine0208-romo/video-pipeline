import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BatteryFull, Globe2, MessageSquare, ShieldAlert, Signal, Wifi } from "lucide-react";
import { clamp01, easeOutCubic } from "../../../engine";
import type { MediaRef, TransitionIn } from "./types";

export type MediaPalette = {
  mode: "dark" | "light";
  bg: string;
  bg2: string;
  text: string;
  text2: string;
  accent: string;
  warn: string;
  line: string;
};

export type MediaGrade = {
  saturation?: number;
  contrast?: number;
  brightness?: number;
  warm?: number;
  cool?: number;
  dim?: number;
};

const gradeFilter = (g: MediaGrade | undefined, fallback?: MediaGrade) => {
  const s = g?.saturation ?? fallback?.saturation ?? 1;
  const c = g?.contrast ?? fallback?.contrast ?? 1;
  const b = g?.brightness ?? fallback?.brightness ?? 1;
  return `saturate(${s}) contrast(${c}) brightness(${b})`;
};

export const FootageLayer: React.FC<{
  src: string;
  inPoint: number;
  dur: number;
  sourceFps?: number;
  speed?: number;
  focus?: [number, number];
  motion?: "push" | "pull" | "panLeft" | "panRight" | "still";
  motionAmount?: number;
  grade?: MediaGrade;
  transitionIn?: TransitionIn;
  palette: MediaPalette;
  objectFit?: "cover" | "contain";
}> = ({
  src,
  inPoint,
  dur,
  sourceFps = 30,
  speed = 1,
  focus = [0.5, 0.5],
  motion = "push",
  motionAmount = 0.05,
  grade,
  transitionIn = "cut",
  palette,
  objectFit = "cover",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const local = frame / fps;
  const p = clamp01(local / Math.max(dur, 1 / fps));
  const amount = Math.max(0, motionAmount);

  let scale = 1;
  let tx = 0;
  if (motion === "push") scale = 1 + amount * easeOutCubic(p);
  if (motion === "pull") scale = 1 + amount * (1 - easeOutCubic(p));
  if (motion === "panLeft") {
    scale = 1 + amount;
    tx = -amount * width * easeOutCubic(p);
  }
  if (motion === "panRight") {
    scale = 1 + amount;
    tx = amount * width * (1 - easeOutCubic(p));
  }
  if (objectFit === "contain") {
    scale = 1;
    tx = 0;
  }

  const whip = transitionIn === "whip" ? Math.max(0, 1 - local / 0.22) : 0;
  const flash = transitionIn === "flash" ? Math.max(0, 1 - local / 0.12) : 0;
  const endAt = Math.round((inPoint + dur * speed) * sourceFps);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: palette.bg }}>
      {objectFit === "contain" ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(90% 70% at 50% 30%, ${palette.bg2} 0%, ${palette.bg} 72%)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${tx + whip * width * 0.16}px) scale(${scale})`,
          filter: `${gradeFilter(grade)}${whip > 0 ? ` blur(${whip * 14}px)` : ""}`,
          transformOrigin: "center",
        }}
      >
        <OffthreadVideo
          src={staticFile(src)}
          startFrom={Math.round(inPoint * sourceFps)}
          endAt={endAt}
          playbackRate={speed}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`,
          }}
        />
      </div>
      {grade?.warm ? (
        <AbsoluteFill
          style={{
            background: `rgba(255,150,70,${Math.min(0.28, grade.warm * 0.28)})`,
            mixBlendMode: "soft-light",
          }}
        />
      ) : null}
      {grade?.cool ? (
        <AbsoluteFill
          style={{
            background: `rgba(70,140,255,${Math.min(0.28, grade.cool * 0.28)})`,
            mixBlendMode: "soft-light",
          }}
        />
      ) : null}
      {grade?.dim ? (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${Math.min(0.85, grade.dim)})` }} />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.34) 100%)",
          pointerEvents: "none",
        }}
      />
      {flash > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};

export const ImageLayer: React.FC<{
  src: string;
  dur: number;
  focus?: [number, number];
  fit?: "cover" | "contain";
  fromZoom?: number;
  toZoom?: number;
  grade?: MediaGrade;
  palette: MediaPalette;
}> = ({
  src,
  dur,
  focus = [0.5, 0.5],
  fit = "cover",
  fromZoom = 1.02,
  toZoom = 1.06,
  grade,
  palette,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clamp01(frame / fps / Math.max(dur, 0.001));
  const start = fit === "contain" ? 1 : fromZoom;
  const end = fit === "contain" ? Math.min(1.03, toZoom) : toZoom;
  const zoom = start + (end - start) * easeOutCubic(p);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: palette.bg }}>
      {fit === "contain" ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(90% 70% at 50% 30%, ${palette.bg2} 0%, ${palette.bg} 72%)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          filter: gradeFilter(grade),
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`,
            transform: `scale(${zoom})`,
            transformOrigin: "center",
          }}
        />
      </div>
      {grade?.dim ? (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${Math.min(0.85, grade.dim)})` }} />
      ) : null}
    </AbsoluteFill>
  );
};

export const ScreenshotLayer: React.FC<{
  media: MediaRef;
  dur: number;
  palette: MediaPalette;
  grade?: MediaGrade;
  inset?: number;
}> = ({ media, dur, palette, grade, inset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clamp01(frame / fps / Math.max(dur, 0.001));
  const zoom = 1 + 0.012 * easeOutCubic(p);
  const light = palette.mode === "light";
  const ratio = `${media.width ?? 4} / ${media.height ?? 3}`;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: palette.bg }}>
      <div
        style={{
          position: "absolute",
          inset,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: ratio,
            overflow: "hidden",
            borderRadius: 18,
            background: light ? "#FFFFFF" : "#0E1622",
            border: `1px solid ${palette.line}`,
            boxShadow: light ? "0 18px 50px rgba(30,25,15,0.18)" : "0 18px 50px rgba(0,0,0,0.5)",
          }}
        >
          <Img
            src={staticFile(media.src ?? "")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: media.fit ?? "contain",
              objectPosition: "center",
              transform: `scale(${zoom})`,
              transformOrigin: "center",
              filter: gradeFilter(grade),
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const UiTag: React.FC<{ palette: MediaPalette }> = ({ palette }) => (
  <span
    style={{
      marginLeft: "auto",
      fontFamily: '"JetBrains Mono"',
      fontSize: 12,
      color: palette.warn,
      border: `1px solid ${palette.warn}88`,
      padding: "2px 6px",
      borderRadius: 4,
    }}
  >
    示意
  </span>
);

export const SmsCodePanel: React.FC<{ palette: MediaPalette }> = ({ palette }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      padding: "16px 14px",
      background: palette.mode === "dark" ? "#0B111B" : "#FFFFFF",
      color: palette.text,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: '"JetBrains Mono"',
        fontSize: 13,
        color: palette.text2,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <Signal size={13} />
        <Wifi size={13} />
        <BatteryFull size={15} />
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
      <MessageSquare size={17} color={palette.accent} />
      <span style={{ fontSize: 17, fontWeight: 700 }}>信息</span>
      <UiTag palette={palette} />
    </div>
    <div style={{ display: "flex", gap: 9, marginTop: 14, alignItems: "center" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          background: `${palette.accent}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: palette.accent,
        }}
      >
        验
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>验证码</div>
        <div style={{ fontSize: 11, color: palette.text2 }}>现在</div>
      </div>
    </div>
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: `${palette.accent}14`,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      【平台】验证码{" "}
      <b style={{ fontFamily: '"JetBrains Mono"', fontSize: 18, color: palette.accent }}>738 492</b>
      ，5 分钟内有效。
    </div>
    <div
      style={{
        marginTop: 12,
        display: "flex",
        gap: 7,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${palette.warn}55`,
        background: `${palette.warn}0F`,
      }}
    >
      <ShieldAlert size={15} color={palette.warn} />
      <span style={{ fontSize: 12, lineHeight: 1.35, color: palette.text2 }}>
        号码不在你名下，可能被回收或易主
      </span>
    </div>
  </div>
);

export const RegionPanel: React.FC<{ palette: MediaPalette }> = ({ palette }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      padding: "16px 14px",
      background: palette.mode === "dark" ? "#0B111B" : "#FFFFFF",
      color: palette.text,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: '"JetBrains Mono"',
        fontSize: 13,
        color: palette.text2,
      }}
    >
      <span>9:41</span>
      <UiTag palette={palette} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
      <Globe2 size={17} color={palette.accent} />
      <span style={{ fontSize: 17, fontWeight: 700 }}>国家 / 地区</span>
    </div>
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 9,
        border: `1px solid ${palette.line}`,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 15,
      }}
    >
      <span>中国大陆</span>
      <span style={{ fontFamily: '"JetBrains Mono"', color: palette.text2 }}>+86</span>
    </div>
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 9,
        border: `1px solid ${palette.warn}55`,
        background: `${palette.warn}0F`,
        display: "flex",
        gap: 7,
        alignItems: "center",
      }}
    >
      <ShieldAlert size={15} color={palette.warn} />
      <span style={{ fontSize: 12, color: palette.text2 }}>该平台暂不支持此地区</span>
    </div>
    <div style={{ marginTop: 12, fontSize: 12, color: palette.text2 }}>
      号码类型：虚拟号 / 接码号 / 实卡
    </div>
  </div>
);

export const MediaView: React.FC<{
  media: MediaRef;
  dur: number;
  palette: MediaPalette;
  still?: boolean;
  motion?: "push" | "pull" | "panLeft" | "panRight" | "still";
  motionAmount?: number;
  grade?: MediaGrade;
  transitionIn?: TransitionIn;
}> = ({ media, dur, palette, still, motion = "push", motionAmount = 0.05, grade, transitionIn }) => {
  if (media.kind === "ui") {
    return media.ui === "sms" ? <SmsCodePanel palette={palette} /> : <RegionPanel palette={palette} />;
  }
  if (media.kind === "screenshot") {
    return <ScreenshotLayer media={media} dur={dur} palette={palette} grade={grade} />;
  }
  if (media.kind === "image") {
    return (
      <ImageLayer
        src={media.src ?? ""}
        dur={dur}
        focus={media.focus}
        fit={media.fit}
        grade={grade}
        palette={palette}
      />
    );
  }
  if (still && media.poster) {
    return (
      <AbsoluteFill>
        <Img
          src={staticFile(media.poster)}
          style={{ width: "100%", height: "100%", objectFit: media.fit ?? "cover" }}
        />
      </AbsoluteFill>
    );
  }
  return (
    <FootageLayer
      src={media.src ?? ""}
      inPoint={media.in ?? 0}
      dur={dur}
      focus={media.focus}
      motion={motion}
      motionAmount={motionAmount}
      grade={grade}
      transitionIn={transitionIn}
      palette={palette}
    />
  );
};

export const MediaFrame: React.FC<{
  media?: MediaRef;
  dur: number;
  palette: MediaPalette;
  ratio?: string;
  style?: React.CSSProperties;
  still?: boolean;
  motion?: "push" | "pull" | "panLeft" | "panRight" | "still";
  motionAmount?: number;
  grade?: MediaGrade;
}> = ({ media, dur, palette, ratio = "4 / 3", style, still, motion, motionAmount, grade }) => {
  if (!media) return null;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: ratio,
        overflow: "hidden",
        borderRadius: 14,
        background: palette.bg,
        ...style,
      }}
    >
      <MediaView
        media={media}
        dur={dur}
        palette={palette}
        still={still}
        motion={motion}
        motionAmount={motionAmount}
        grade={grade}
      />
    </div>
  );
};
