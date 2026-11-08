import path from "node:path";
import { readJson, shortHash, writeJson } from "../lib/fsx.mjs";
import { PIPELINE_ROOT } from "../lib/config.mjs";

const PALETTES = ["aurora", "ember", "mono", "lime", "ice"];
const CLIP_CYCLE = ["sms", "call", "account", "gate", "platform-icon"];

function rotate(list, offset) {
  if (!list.length) return list;
  const index = offset % list.length;
  return [...list.slice(index), ...list.slice(0, index)];
}

function hashNumber(value) {
  return Number.parseInt(shortHash(value, 8), 16) % 1000000;
}

function variantProps({ preset, index, assets }) {
  const palette = PALETTES[index % PALETTES.length];
  const seed = hashNumber(`${preset}:${index}`);

  if (preset === "platform-orbit" || preset === "kinetic-grid") {
    return { icons: rotate(assets.social, index), palette, seed };
  }
  if (preset === "social-constellation" || preset === "network-universe") {
    return { icons: rotate(assets.social, index + 2), palette, seed };
  }
  if (preset === "icon-morph") {
    const icons = rotate(assets.messaging, index);
    const labels = icons.map((icon) => {
      const platform = assets.platforms.find((item) => item.icon === icon);
      return platform?.name ?? "";
    });
    return { icons, labels, palette, seed };
  }
  if (preset === "ui-mock") {
    const platform = assets.platforms[index % assets.platforms.length];
    const clip = CLIP_CYCLE[index % CLIP_CYCLE.length];
    return {
      clip,
      platform: platform.name,
      icon: platform.icon,
      palette,
      seed,
    };
  }
  return { palette, seed };
}

export function buildCatalog(cfg) {
  const presetFile = path.join(PIPELINE_ROOT, "src", "generated", "presets.json");
  const assetFile = path.join(PIPELINE_ROOT, "src", "generated", "assets.json");
  const meta = readJson(presetFile, { presets: [] });
  const assets = readJson(assetFile, {});
  const byId = new Map(meta.presets.map((item) => [item.id, item]));
  const formats = new Set(cfg.generate.formats ?? ["mp4"]);

  const entries = [];
  for (const preset of cfg.generate.presets) {
    const presetMeta = byId.get(preset);
    if (!presetMeta) {
      throw new Error(
        `未知 preset：${preset}。可选：${meta.presets.map((item) => item.id).join(", ")}`,
      );
    }
    for (let index = 0; index < cfg.generate.variantsPerPreset; index += 1) {
      const props = variantProps({ preset, index, assets });
      const duration = Number(cfg.generate.duration ?? 3);
      const durationInFrames = Math.max(
        1,
        Math.round(duration * Number(cfg.spec.fps ?? 30)),
      );
      const id = `${preset}-v${index + 1}-${shortHash(JSON.stringify(props), 6)}`;
      const alpha = Boolean(presetMeta.supportsAlpha);
      const entry = {
        id,
        preset,
        description: presetMeta.description,
        props,
        alpha,
        width: cfg.spec.width,
        height: cfg.spec.height,
        fps: cfg.spec.fps,
        duration,
        durationInFrames,
        publicMp4: `generated/${id}.mp4`,
        fileMp4: path.join(cfg.paths.out, "assets", `${id}.mp4`),
        publicWebm:
          alpha && formats.has("webm-alpha") ? `generated/${id}.webm` : null,
        fileWebm:
          alpha && formats.has("webm-alpha")
            ? path.join(cfg.paths.out, "assets", `${id}.webm`)
            : null,
        propsMp4File: path.join(cfg.paths.data, "props", `${id}.mp4.json`),
        propsWebmFile:
          alpha && formats.has("webm-alpha")
            ? path.join(cfg.paths.data, "props", `${id}.webm.json`)
            : null,
        tags: {
          preset,
          palette: props.palette,
          alpha,
          icons: props.icons ?? [],
        },
        license:
          "品牌图标来自 Simple Icons（CC0 1.0），品牌标识归各平台所有，仅作类别示意。",
      };
      writeJson(entry.propsMp4File, {
        preset,
        props,
        alpha: false,
        durationInFrames,
        fps: cfg.spec.fps,
        width: cfg.spec.width,
        height: cfg.spec.height,
      });
      if (entry.propsWebmFile) {
        writeJson(entry.propsWebmFile, {
          preset,
          props,
          alpha: true,
          durationInFrames,
          fps: cfg.spec.fps,
          width: cfg.spec.width,
          height: cfg.spec.height,
        });
      }
      entries.push(entry);
    }
  }
  return entries;
}

export function writeCatalog(cfg, entries) {
  const file = path.join(cfg.paths.data, "catalog.json");
  writeJson(file, {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets: entries,
  });
  return file;
}

export function readCatalog(cfg) {
  const file = path.join(cfg.paths.data, "catalog.json");
  const data = readJson(file, null);
  if (!data?.assets?.length) {
    throw new Error("生成素材库为空：先运行 node run.mjs generate");
  }
  return data.assets;
}
