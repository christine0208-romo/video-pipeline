import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp01, easeOutCubic, useFonts } from "./platform";
import { FONT_MANIFEST } from "../creative/registry";
import type { MixAudioMusic, MixEdl, MixShot, ShotTransform } from "./mix/types";

const FPS_FALLBACK = 30;

const gradeFilter = (transform?: ShotTransform) => {
  const grade = transform?.grade;
  if (!grade) return "none";
  const saturation = grade.saturation ?? 1;
  const contrast = grade.contrast ?? 1;
  const brightness = grade.brightness ?? 1;
  return `saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`;
};



const TransitionClip: React.FC<{
  asset: NonNullable<MixShot["transitionAsset"]>;
}> = ({ asset }) => {
  const { fps } = useVideoConfig();
  const frames = Math.max(1, Math.round(asset.dur * fps));
  return (
    <Sequence from={0} durationInFrames={frames} name="transition">
      <Video
        src={staticFile(asset.src)}
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </Sequence>
  );
};

const FootageView: React.FC<{ shot: MixShot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const local = frame / fps;
  const p = clamp01(local / Math.max(shot.dur, 1 / fps));
  const transform = shot.transform ?? {};
  const motion = transform.motion ?? "push";
  const amount = Math.max(0, transform.motionAmount ?? 0.05);
  const baseZoom = transform.zoom ?? 1.05;

  let scale = baseZoom;
  let tx = 0;
  let ty = 0;
  if (motion === "push") scale = baseZoom * (1 + amount * easeOutCubic(p));
  if (motion === "pull") scale = baseZoom * (1 + amount * (1 - easeOutCubic(p)));
  if (motion === "panLeft") {
    scale = baseZoom;
    tx = -amount * width * easeOutCubic(p);
  }
  if (motion === "panRight") {
    scale = baseZoom;
    tx = amount * width * (1 - easeOutCubic(p));
  }
  if (motion === "panUp") {
    scale = baseZoom;
    ty = -amount * width * easeOutCubic(p);
  }
  if (motion === "panDown") {
    scale = baseZoom;
    ty = amount * width * (1 - easeOutCubic(p));
  }

  const sourceFps = shot.sourceFps ?? FPS_FALLBACK;
  const speed = shot.speed ?? 1;
  const startFrom = Math.round((shot.in ?? 0) * sourceFps);
  const endAt = Math.round(((shot.in ?? 0) + shot.dur * speed) * sourceFps);
  const focus = transform.focus ?? [0.5, 0.5];
  const overlayFrames = shot.overlay
    ? Math.max(1, Math.round(shot.overlay.dur * fps))
    : 0;
  const overlayDelay = shot.transitionAsset
    ? Math.round(shot.transitionAsset.dur * fps)
    : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          filter: gradeFilter(transform),
          transformOrigin: "center",
        }}
      >
        <OffthreadVideo
          src={staticFile(shot.src)}
          startFrom={startFrom}
          endAt={endAt}
          playbackRate={speed}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`,
          }}
        />
      </div>
      {shot.overlay && overlayFrames > overlayDelay ? (
        <Sequence
          from={overlayDelay}
          durationInFrames={overlayFrames - overlayDelay}
          name="overlay"
        >
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <Video
              src={staticFile(shot.overlay.src)}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                mixBlendMode: shot.overlay.blend ?? "normal",
              }}
            />
          </AbsoluteFill>
        </Sequence>
      ) : null}
      {shot.transitionAsset ? <TransitionClip asset={shot.transitionAsset} /> : null}
    </AbsoluteFill>
  );
};

const GeneratedView: React.FC<{ shot: MixShot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const local = frame / fps;
  const p = clamp01(local / Math.max(shot.dur, 1 / fps));
  const transform = shot.transform ?? {};
  const motion = transform.motion ?? "push";
  const amount = Math.max(0, transform.motionAmount ?? 0.05);
  const baseZoom = transform.zoom ?? 1.02;

  let scale = baseZoom;
  let tx = 0;
  let ty = 0;
  if (motion === "push") scale = baseZoom * (1 + amount * easeOutCubic(p));
  if (motion === "pull") scale = baseZoom * (1 + amount * (1 - easeOutCubic(p)));
  if (motion === "panLeft") tx = -amount * width * easeOutCubic(p);
  if (motion === "panRight") tx = amount * width * (1 - easeOutCubic(p));
  if (motion === "panUp") ty = -amount * width * easeOutCubic(p);
  if (motion === "panDown") ty = amount * width * (1 - easeOutCubic(p));

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#04070C" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          filter: gradeFilter(transform),
          transformOrigin: "center",
        }}
      >
        <OffthreadVideo
          src={staticFile(shot.src)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {shot.transitionAsset ? <TransitionClip asset={shot.transitionAsset} /> : null}
    </AbsoluteFill>
  );
};

const ImageView: React.FC<{ shot: MixShot }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = clamp01(frame / fps / Math.max(shot.dur, 0.001));
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Img
        src={staticFile(shot.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.02 + 0.06 * easeOutCubic(p)})`,
        }}
      />
      {shot.transitionAsset ? <TransitionClip asset={shot.transitionAsset} /> : null}
    </AbsoluteFill>
  );
};

const MUSIC_ROLE_GAIN: Record<string, number> = {
  hook: 0.9,
  build: 1,
  proof: 1,
  turn: 0.7,
  close: 0.55,
};

export const MixVideo: React.FC<{ edl: MixEdl }> = ({ edl }) => {
  const ready = useFonts(FONT_MANIFEST);
  if (!ready) return null;

  const shots = edl.beats.flatMap((beat) => beat.shots);
  const music: MixAudioMusic | null =
    edl.audio?.music ??
    (edl.audio?.src
      ? { src: edl.audio.src, volume: edl.audio.volume }
      : null);
  const sfx = edl.audio?.sfx ?? [];
  const sfxWindows = sfx.map(
    (item) => [item.at, item.at + (item.dur ?? 0.35)] as const,
  );

  const musicVolume = (f: number) => {
    if (!music) return 0;
    const t = f / edl.fps;
    const total = edl.durationInFrames / edl.fps;
    const fadeIn = Math.max(0.001, music.fadeIn ?? 0.6);
    const fadeOut = Math.max(0.001, music.fadeOut ?? 0.6);
    const inGain = Math.min(1, t / fadeIn);
    const outGain = Math.min(1, (total - t) / fadeOut);
    const beat = edl.beats.find((item) => t >= item.at && t < item.at + item.dur);
    const roleGain = MUSIC_ROLE_GAIN[beat?.role ?? "proof"] ?? 0.9;
    const ducked = sfxWindows.some(
      ([start, end]) => t >= start - 0.05 && t <= end + 0.12,
    );
    const base = music.volume ?? 0.32;
    const level = ducked ? (music.duckTo ?? base * 0.4) : base;
    return level * roleGain * Math.max(0, Math.min(inGain, outGain));
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {music ? (
        <Audio
          src={staticFile(music.src)}
          volume={musicVolume}
          loop={Boolean(music.loop)}
        />
      ) : null}
      {sfx.map((item, index) => {
        const from = Math.max(0, Math.round(item.at * edl.fps));
        if (from >= edl.durationInFrames) return null;
        const durationInFrames = Math.max(
          1,
          Math.min(
            Math.round((item.dur ?? 0.35) * edl.fps),
            edl.durationInFrames - from,
          ),
        );
        return (
          <Sequence
            key={`sfx-${item.assetId ?? index}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
            name={`sfx-${item.category ?? "sfx"}`}
          >
            <Audio src={staticFile(item.src)} volume={item.volume ?? 0.4} />
          </Sequence>
        );
      })}
      {shots.map((shot, index) => {
        const from = Math.round(shot.at * edl.fps);
        const durationInFrames = Math.max(1, Math.round(shot.dur * edl.fps));
        return (
          <Sequence
            key={`${shot.assetId}-${index}`}
            from={from}
            durationInFrames={durationInFrames}
            name={shot.kind}
          >
            {shot.kind === "footage" ? (
              <FootageView shot={shot} />
            ) : shot.kind === "image" ? (
              <ImageView shot={shot} />
            ) : (
              <GeneratedView shot={shot} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
