import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PIPELINE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
/** 独立工作区：所有公共资源都在本目录下，不再指向仓库父级。 */
export const REPO_ROOT = PIPELINE_ROOT;
export const WORKSPACE_ROOT = PIPELINE_ROOT;

const DEFAULTS = {
  spec: { width: 1080, height: 1920, fps: 30 },
  dataDir: "data",
  outDir: "out",
  tools: { ffmpeg: "ffmpeg", ffprobe: "ffprobe" },
  footage: {
    roots: ["D:/Files/AI_Vedio/1_素材库/vedio"],
    extensions: [
      ".mp4",
      ".mov",
      ".m4v",
      ".mkv",
      ".avi",
      ".webm",
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
    ],
    exclude: [
      "node_modules",
      ".git",
      "$RECYCLE.BIN",
      "System Volume Information",
      ".cache",
    ],
    sidecars: ["tags.json"],
    cropDetect: true,
    sceneSplit: { enabled: true, threshold: 0.32, minShot: 1.2, pad: 0.15 },
    thumbs: { enabled: true, count: 3, width: 480 },
  },
  generate: {
    presets: [
      "platform-orbit",
      "social-constellation",
      "network-universe",
      "icon-morph",
      "ui-mock",
      "kinetic-grid",
    ],
    variantsPerPreset: 2,
    duration: 3,
    formats: ["mp4", "webm-alpha"],
  },
  mix: {
    duration: 30,
    outputs: 1,
    seed: 20261108,
    maxPerAsset: 3,
    minGap: 2,
    generatedRatio: 0.3,
    music: null,
    beats: [
      { role: "hook", ratio: 0.14 },
      { role: "build", ratio: 0.26 },
      { role: "proof", ratio: 0.3 },
      { role: "turn", ratio: 0.18 },
      { role: "close", ratio: 0.12 },
    ],
  },
};

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positionals };
}

export function deepMerge(base, patch) {
  if (Array.isArray(patch)) return patch.slice();
  if (patch && typeof patch === "object") {
    const out = { ...(base ?? {}) };
    for (const [key, value] of Object.entries(patch)) {
      out[key] = deepMerge(base?.[key], value);
    }
    return out;
  }
  return patch;
}

const isTrue = (value) => value === true || value === "true" || value === "1";

function resolveConfigPath(raw) {
  const value = typeof raw === "string" ? raw : "config/pipeline.json";
  if (path.isAbsolute(value)) return value;
  for (const candidate of [
    path.resolve(process.cwd(), value),
    path.resolve(PIPELINE_ROOT, value),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return path.resolve(PIPELINE_ROOT, value);
}

export function loadConfig(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const configPath = resolveConfigPath(flags.config);
  const fileConfig = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf8"))
    : {};
  const cfg = deepMerge(DEFAULTS, fileConfig);

  if (flags.roots) {
    cfg.footage.roots = String(flags.roots)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (flags.duration) cfg.mix.duration = Number(flags.duration);
  if (flags["generate-duration"]) {
    cfg.generate.duration = Number(flags["generate-duration"]);
  }
  if (flags.outputs) cfg.mix.outputs = Number(flags.outputs);
  if (flags.seed) cfg.mix.seed = Number(flags.seed);
  if (flags.presets) {
    cfg.generate.presets = String(flags.presets)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (flags.variants) cfg.generate.variantsPerPreset = Number(flags.variants);
  if (flags.limit) cfg.limit = Number(flags.limit);
  if (flags.only) {
    cfg.generate.presets = String(flags.only)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (isTrue(flags["no-scenes"])) cfg.footage.sceneSplit.enabled = false;
  if (isTrue(flags["no-thumbs"])) cfg.footage.thumbs.enabled = false;
  if (isTrue(flags["no-crop"])) cfg.footage.cropDetect = false;

  cfg.configPath = configPath;
  cfg.flags = flags;
  cfg.positionals = positionals;
  cfg.paths = {
    pipeline: PIPELINE_ROOT,
    repo: REPO_ROOT,
    data: path.resolve(PIPELINE_ROOT, cfg.dataDir),
    out: path.resolve(PIPELINE_ROOT, cfg.outDir),
    public: path.resolve(PIPELINE_ROOT, "public"),
  };
  cfg.footage.roots = cfg.footage.roots.map((root) =>
    path.isAbsolute(root) ? path.normalize(root) : path.resolve(REPO_ROOT, root),
  );
  return cfg;
}
