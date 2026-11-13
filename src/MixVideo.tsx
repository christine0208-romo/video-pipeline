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
import { FONT_MANIFEST, clamp01, easeOutCubic, useFonts } from "./platform";
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

const Grain: React.FC<{ amount?: number }> = ({ amount = 0.05 }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 37) % 100;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: amount,
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.8px)",
        backgroundSize: "3px 3px",
        backgroundPosition: `${offset}px ${(offset * 1.7) % 100}px`,
      }}
    />
  );
};

const Scanline: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.12,
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 4px)",
    }}
  />
);

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(120% 90% at 50% 44%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.5) 100%)",
    }}
  />
);

const TransitionFx: React.FC<{ type?: MixShot["transitionIn"] }> = ({ type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (type === "flash") {
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "#FFFFFF",
          opacity: Math.max(0, 1 - t / 0.14),
        }}
      />
    );
  }
  if (type === "whip") {
    const p = Math.max(0, 1 - t / 0.22);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "#FFFFFF",
          opacity: p * 0.16,
          transform: `translateX(${(1 - p) * 38}%)`,
        }}
      />
    );
  }
  if (type === "zoom") {
    const p = Math.max(0, 1 - t / 0.28);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%)",
          opacity: p,
          transform: `scale(${1 + 0.06 * p})`,
        }}
      />
    );
  }
  if (type === "wipe") {
    const p = Math.max(0, 1 - t / 0.3);
    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: "#FFFFFF",
          opacity: p * 0.9,
          transform: `translateX(${(1 - p) * 100}%)`,
        }}
      />
    );
  }
  return null;
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
      {transform.overlay === "grain" ? <Grain /> : null}
      {transform.overlay === "scanline" ? <Scanline /> : null}
      {transform.overlay === "vignette" ? <Vignette /> : null}
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
      {shot.transitionAsset ? (
        <TransitionClip asset={shot.transitionAsset} />
      ) : (
        <TransitionFx type={shot.transitionIn} />
      )}
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
      {transform.overlay === "grain" ? <Grain /> : null}
      {transform.overlay === "scanline" ? <Scanline /> : null}
      {transform.overlay === "vignette" ? <Vignette /> : null}
      {shot.transitionAsset ? (
        <TransitionClip asset={shot.transitionAsset} />
      ) : (
        <TransitionFx type={shot.transitionIn} />
      )}
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
      {shot.transitionAsset ? (
        <TransitionClip asset={shot.transitionAsset} />
      ) : (
        <TransitionFx type={shot.transitionIn} />
      )}
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
