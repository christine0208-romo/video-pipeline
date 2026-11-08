/**
 * 批次系统的内核类型。
 *
 * 与旧 Reel 的区别：EDL 不再包含通用模板参数，而是带 pack + narrative；
 * 每个 pack 自己解释 beat.props，版式、字体、动效、转场互不共用。
 */

export type PackId =
  | "horizontal-table"
  | "split-debate"
  | "field-notes"
  | "icon-journey"
  | "clip-remix";

export type NarrativeId =
  | "parallel"
  | "debate"
  | "checklist"
  | "myth"
  | "journey"
  | "remix";

export type BeatRole = "hook" | "body" | "end";

export type TransitionIn = "cut" | "flash" | "whip" | "zoom" | "wipe";

export type EvidenceRole = "official" | "forum" | "account" | "proof" | "illustration";

export type EvidenceProvenance = {
  sourceUrl?: string;
  capturedAt?: string;
  redactions?: string[];
  label?: string;
  role?: EvidenceRole;
  illustrative?: boolean;
};

export type MediaRef = {
  kind: "footage" | "image" | "ui" | "screenshot";
  /** footage */
  src?: string;
  in?: number;
  out?: number;
  focus?: [number, number];
  poster?: string;
  /** image */
  width?: number;
  height?: number;
  /** ui illustration */
  ui?: "sms" | "region";
  /** image / screenshot framing */
  fit?: "cover" | "contain";
  /** screenshot provenance (metadata only; never rendered on screen) */
  provenance?: EvidenceProvenance;
};

export type GeneratedClipId = "platform-icon" | "gate" | "sms" | "call" | "account";

/** 混剪时间线里的一个片段。实拍与代码生成共用同一结构。 */
export type ClipSpec = {
  kind: "footage" | "image" | "screenshot" | "generated";
  assetId?: string;
  generator?: GeneratedClipId;
  in?: number;
  out?: number;
  speed?: number;
  duration?: number;
  focus?: [number, number];
  motion?: "push" | "pull" | "panLeft" | "panRight" | "still";
  motionAmount?: number;
  transitionIn?: TransitionIn;
  /** 解析后的媒体；由 build 阶段写入 */
  media?: MediaRef;
  /** 生成片段自己的参数 */
  props?: Record<string, unknown>;
};

export type PackBeat = {
  id: string;
  role: BeatRole;
  /** 秒 */
  at: number;
  /** 秒 */
  dur: number;
  /** 口播原文，仅供审计；渲染不直接读 */
  text?: string;
  /** 画面贴片 */
  overlay?: string;
  /** 单媒体 pack 用；多媒体的 pack 把 media 放进 props */
  media?: MediaRef;
  /** pack 专属字段，由 pack 自己解释 */
  props: Record<string, unknown>;
  transitionIn?: TransitionIn;
};

export type PackEdl = {
  version: 2;
  id: string;
  batch: string;
  title: string;
  pack: PackId;
  narrative: NarrativeId;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  stills: number[];
  audio?: { mix?: string };
  music?: { src?: string; bpm?: number; offset?: number };
  sfx?: { type: string; at: number; gain?: number; pan?: number }[];
  beats: PackBeat[];
};

/** 兼容 Root / batches.generated.ts 的旧名字 */
export type Edl = PackEdl;

export type StylePackMeta = {
  id: PackId;
  name: string;
  description: string;
  narratives: NarrativeId[];
  requiredEvidence: string[];
  avoid: string[];
};

export type PackRendererProps = {
  beat: PackBeat;
  edl: PackEdl;
};
