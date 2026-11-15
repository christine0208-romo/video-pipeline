import React from "react";
import type { CalculateMetadataFunction } from "remotion";
import { Composition } from "remotion";
import { GeneratedAsset } from "./GeneratedAsset";
import { MixVideo } from "./MixVideo";
import { PRESET_IDS } from "../creative/registry";
import pipelineConfig from "../config/pipeline.json";
import type { AssetProps } from "./types";
import type { MixEdl } from "./mix/types";

const SPEC = pipelineConfig.spec;

const EMPTY_EDL: MixEdl = {
  version: 1,
  id: "empty",
  width: SPEC.width,
  height: SPEC.height,
  fps: SPEC.fps,
  durationInFrames: 1,
  stills: [],
  audio: null,
  beats: [],
};

const assetMetadata: CalculateMetadataFunction<AssetProps> = ({ props }) => ({
  durationInFrames: Math.max(1, Math.round(props.durationInFrames ?? 90)),
  fps: props.fps ?? 30,
  width: props.width ?? 1080,
  height: props.height ?? 1920,
  props,
});

const mixMetadata: CalculateMetadataFunction<{ edl: MixEdl }> = ({ props }) => ({
  durationInFrames: Math.max(1, props.edl.durationInFrames),
  fps: props.edl.fps,
  width: props.edl.width,
  height: props.edl.height,
  props,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="PipelineAsset"
      component={GeneratedAsset}
      durationInFrames={90}
      fps={SPEC.fps}
      width={SPEC.width}
      height={SPEC.height}
      defaultProps={{
        preset: PRESET_IDS[0] ?? "",
        props: {},
        alpha: false,
        durationInFrames: 90,
      }}
      calculateMetadata={assetMetadata}
    />
    <Composition
      id="MixVideo"
      component={MixVideo}
      durationInFrames={1}
      fps={SPEC.fps}
      width={SPEC.width}
      height={SPEC.height}
      defaultProps={{ edl: EMPTY_EDL }}
      calculateMetadata={mixMetadata}
    />
  </>
);
