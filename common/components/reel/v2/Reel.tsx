import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { FONT_MANIFEST, useFonts } from "../../../engine";
import { PACKS } from "./packs/registry";
import { BeatTransition } from "./shared";
import type { PackEdl } from "./types";

/**
 * 批次渲染器：只负责时间轴、音轨、转场和分发；
 * 画面语法完全由 edl.pack 对应的 Style Pack 决定。
 */
export const Reel: React.FC<{ edl: PackEdl }> = ({ edl }) => {
  const ready = useFonts(FONT_MANIFEST);
  if (!ready) return null;

  const pack = PACKS[edl.pack];
  if (!pack) throw new Error(`未知 Style Pack：${edl.pack}`);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {edl.audio?.mix ? <Audio src={staticFile(edl.audio.mix)} /> : null}
      {edl.beats.map((beat) => {
        const from = Math.round(beat.at * edl.fps);
        const to = Math.round((beat.at + beat.dur) * edl.fps);
        return (
          <Sequence key={beat.id} from={from} durationInFrames={Math.max(1, to - from)} name={beat.role}>
            <pack.Render beat={beat} edl={edl} />
            <BeatTransition type={beat.transitionIn} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
