import type React from "react";
import registry from "./registry.json";
import type { NarrativeId, PackId, PackRendererProps, StylePackMeta } from "../types";
import { HorizontalTable } from "./horizontal-table";
import { SplitDebate } from "./split-debate";
import { FieldNotes } from "./field-notes";
import { IconJourney } from "./icon-journey";
import { ClipRemix } from "./clip-remix";

export type StylePack = StylePackMeta & {
  Render: React.FC<PackRendererProps>;
};

const RENDERERS: Record<PackId, React.FC<PackRendererProps>> = {
  "horizontal-table": HorizontalTable,
  "split-debate": SplitDebate,
  "field-notes": FieldNotes,
  "icon-journey": IconJourney,
  "clip-remix": ClipRemix,
};

export const PACK_META = registry.packs as StylePackMeta[];
export const NARRATIVES = registry.narratives as Record<
  NarrativeId,
  { name: string; shape: string; rules: string[] }
>;

export const PACKS = Object.fromEntries(
  PACK_META.map((meta) => [meta.id, { ...meta, Render: RENDERERS[meta.id] }]),
) as Record<PackId, StylePack>;

export const PACK_IDS = PACK_META.map((p) => p.id);
export const NARRATIVE_IDS = Object.keys(NARRATIVES) as NarrativeId[];
