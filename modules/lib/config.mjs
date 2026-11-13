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

const DEFAULTS = {};

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

const splitList = (value) =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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
  const localPath = path.join(path.dirname(configPath), "local.json");
  const localConfig = existsSync(localPath)
    ? JSON.parse(readFileSync(localPath, "utf8"))
    : {};
  const cfg = deepMerge(deepMerge(DEFAULTS, fileConfig), localConfig);

  if (flags.roots) {
    cfg.footage.roots = splitList(flags.roots);
  }
  if (flags.duration) cfg.mix.duration = Number(flags.duration);
  if (flags["shot-length"]) {
    const value = Math.max(0.6, Number(flags["shot-length"]));
    cfg.mix.shotLength = { min: value * 0.8, max: value * 1.25 };
  }
  if (flags["shot-min"]) {
    cfg.mix.shotLength = {
      ...cfg.mix.shotLength,
      min: Math.max(0.6, Number(flags["shot-min"])),
    };
  }
  if (flags["shot-max"]) {
    cfg.mix.shotLength = {
      ...cfg.mix.shotLength,
      max: Math.max(0.6, Number(flags["shot-max"])),
    };
  }
  if (flags["beat-jitter"]) {
    cfg.mix.beatJitter = Math.max(0, Number(flags["beat-jitter"]));
  }
  if (flags["min-shots"]) cfg.mix.minShots = Number(flags["min-shots"]);
  if (flags["max-shots"]) cfg.mix.maxShots = Number(flags["max-shots"]);
  if (flags["generate-duration"]) {
    cfg.generate.duration = Number(flags["generate-duration"]);
  }
  if (flags.outputs) cfg.mix.outputs = Number(flags.outputs);
  if (flags.seed) cfg.mix.seed = Number(flags.seed);
  if (flags.presets) {
    cfg.generate.presets = splitList(flags.presets);
  }
  if (flags.variants) {
    cfg.generate.variantsPerPreset = Number(flags.variants);
    cfg.generate.variantsPerRecipe = Number(flags.variants);
  }
  if (flags["variants-recipe"]) {
    cfg.generate.variantsPerRecipe = Number(flags["variants-recipe"]);
  }
  if (flags.limit) cfg.limit = Number(flags.limit);
  if (flags.only) {
    cfg.generate.presets = splitList(flags.only);
    cfg.generate.recipes = [];
  }
  if (flags.recipe) {
    cfg.generate.recipes = splitList(flags.recipe);
    cfg.generate.presets = [];
  }
  if (isTrue(flags["no-recipes"])) cfg.generate.recipes = [];
  if (isTrue(flags["no-scenes"])) cfg.footage.sceneSplit.enabled = false;
  if (isTrue(flags["no-thumbs"])) cfg.footage.thumbs.enabled = false;
  if (isTrue(flags["no-crop"])) cfg.footage.cropDetect = false;
  if (isTrue(flags["allow-draft"])) cfg.mix.allowDraft = true;
  if (isTrue(flags["allow-low-quality"])) cfg.mix.allowLowQuality = true;
  if (isTrue(flags["no-perceptual-dedupe"])) {
    cfg.mix.perceptualDedupe = false;
  }
  if (isTrue(flags["require-work-asset"])) cfg.mix.requireWorkAsset = true;
  if (isTrue(flags["with-assets"])) cfg.fission.generateAssets = true;
  if (isTrue(flags["no-assets"])) cfg.fission.generateAssets = false;
  if (isTrue(flags["no-music"])) cfg.mix.music = null;
  if (flags.music) {
    const value = String(flags.music);
    const base =
      typeof cfg.mix.music === "object" && cfg.mix.music ? cfg.mix.music : {};
    cfg.mix.music =
      value === "auto"
        ? { ...base, mode: "auto" }
        : { ...base, mode: "file", file: value };
  }
  if (flags["music-mood"] || flags["music-energy"] || flags["music-volume"]) {
    const base =
      typeof cfg.mix.music === "object" && cfg.mix.music
        ? cfg.mix.music
        : { mode: "auto" };
    cfg.mix.music = {
      ...base,
      ...(flags["music-mood"] ? { mood: String(flags["music-mood"]) } : {}),
      ...(flags["music-energy"]
        ? { energy: String(flags["music-energy"]) }
        : {}),
      ...(flags["music-volume"]
        ? { volume: Number(flags["music-volume"]) }
        : {}),
    };
  }
  if (isTrue(flags["no-sfx"])) cfg.mix.sfx.enabled = false;
  if (isTrue(flags.sfx)) cfg.mix.sfx.enabled = true;
  if (flags.bpm) cfg.mix.bpm = Number(flags.bpm);
  if (flags.work) cfg.mix.work = String(flags.work);
  if (flags.works) cfg.fission.works = Number(flags.works);
  if (flags["work-seed"]) {
    cfg.fission.workSeed = Number(flags["work-seed"]);
  }
  if (flags["per-layer"]) {
    const [scene, overlay, transition] = splitList(flags["per-layer"]).map(
      Number,
    );
    cfg.fission.assetsPerLayer = {
      scene: scene ?? cfg.fission.assetsPerLayer.scene,
      overlay: overlay ?? cfg.fission.assetsPerLayer.overlay,
      transition: transition ?? cfg.fission.assetsPerLayer.transition,
    };
  }
  if (flags.scene) cfg.fission.assetsPerLayer.scene = Number(flags.scene);
  if (flags.overlay) {
    cfg.fission.assetsPerLayer.overlay = Number(flags.overlay);
  }
  if (flags.transition) {
    cfg.fission.assetsPerLayer.transition = Number(flags.transition);
  }

  cfg.configPath = configPath;
  cfg.localConfigPath = existsSync(localPath) ? localPath : null;
  cfg.flags = flags;
  cfg.positionals = positionals;
  const dataRoot = cfg.dataDir ?? "data";
  const outputRoot = cfg.outDir ?? "out";
  const runtime = cfg.runtime ?? {};
  cfg.paths = {
    pipeline: PIPELINE_ROOT,
    repo: REPO_ROOT,
    data: path.resolve(PIPELINE_ROOT, dataRoot),
    out: path.resolve(PIPELINE_ROOT, outputRoot),
    public: path.resolve(PIPELINE_ROOT, runtime.publicDir ?? "public"),
    cache: path.resolve(PIPELINE_ROOT, runtime.cacheDir ?? ".cache/video-pipeline"),
    temp: path.resolve(PIPELINE_ROOT, runtime.tempDir ?? ".cache/video-pipeline/tmp"),
    release: path.resolve(PIPELINE_ROOT, runtime.releaseDir ?? "release"),
  };
  cfg.footage.roots = cfg.footage.roots.map((root) =>
    path.isAbsolute(root) ? path.normalize(root) : path.resolve(REPO_ROOT, root),
  );
  return cfg;
}
