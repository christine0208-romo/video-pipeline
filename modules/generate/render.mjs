import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { renderStill, renderVideo } from "../lib/render.mjs";
import { stillFrames } from "./catalog.mjs";

export function renderAsset(
  cfg,
  entry,
  { force = false, dryRun = false, logPrefix = "[generate]" } = {},
) {
  const stillDir = path.join(cfg.paths.out, "stills", "assets");
  mkdirSync(stillDir, { recursive: true });
  mkdirSync(path.join(cfg.paths.out, "assets"), { recursive: true });

  const targets = [];
  if (force || !existsSync(entry.fileMp4)) {
    targets.push({
      file: entry.fileMp4,
      args: {
        composition: "PipelineAsset",
        out: entry.fileMp4,
        props: entry.propsMp4File,
        codec: "h264",
        pixelFormat: "yuv420p",
        crf: 19,
        muted: true,
      },
    });
  }
  if (entry.fileWebm && (force || !existsSync(entry.fileWebm))) {
    targets.push({
      file: entry.fileWebm,
      args: {
        composition: "PipelineAsset",
        out: entry.fileWebm,
        props: entry.propsWebmFile,
        codec: "vp9",
        pixelFormat: "yuva420p",
        imageFormat: "png",
        muted: true,
      },
    });
  }

  if (dryRun) {
    console.log(
      `${logPrefix} dry-run ${entry.id} -> ${
        targets.length
          ? targets.map((target) => path.basename(target.file)).join(", ")
          : "已存在"
      }`,
    );
    return 0;
  }

  for (const target of targets) {
    renderVideo(target.args);
  }

  for (const frame of stillFrames(entry)) {
    const still = path.join(stillDir, `${entry.id}-${frame}.png`);
    if (force || !existsSync(still)) {
      renderStill({
        composition: "PipelineAsset",
        frame,
        out: still,
        props: entry.propsMp4File,
      });
    }
  }
  return targets.length;
}
