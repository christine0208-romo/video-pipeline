import path from "node:path";
import { PIPELINE_ROOT } from "../lib/config.mjs";
import { readJson } from "../lib/fsx.mjs";
import { makeRng, seedFrom, shuffle } from "../lib/rng.mjs";

const CACHE = new Map();

function load(file, fallback) {
  if (!CACHE.has(file)) CACHE.set(file, readJson(file, fallback));
  return CACHE.get(file);
}

const sharedRoot = (cfg) =>
  cfg?.paths?.shared ?? path.join(PIPELINE_ROOT, "shared");

export function readVariation(cfg = null) {
  return load(path.join(sharedRoot(cfg), "variation.json"), {
    palettes: [],
    text: {},
    particle: {},
    camera: {},
    transition: {},
    durations: {},
    rhythmProfiles: [],
  });
}

const pick = (list, rnd) =>
  list.length ? list[Math.floor(rnd() * list.length)] : undefined;

const textProfile = (text, rnd) => ({
  align: pick(text.aligns ?? ["center"], rnd) ?? "center",
  vertical: pick(text.verticals ?? ["center"], rnd) ?? "center",
  background: pick(text.backgrounds ?? ["none"], rnd) ?? "none",
  light: pick(text.lights ?? ["center"], rnd) ?? "center",
  letterSpacing: pick(text.letterSpacings ?? [0.02], rnd) ?? 0.02,
  lineHeight: pick(text.lineHeights ?? [1.15], rnd) ?? 1.15,
  fontSize: pick(text.fontSizes ?? [], rnd),
  fontWeight: pick(text.fontWeights ?? [], rnd),
  maxWidth: pick(text.maxWidths ?? [], rnd),
  copy: text.copy ?? [],
  keywords: text.keywords ?? [],
  numbers: text.numbers ?? [],
});

const particleProfile = (particle, rnd) => ({
  distribution: pick(particle.distributions ?? ["random"], rnd) ?? "random",
  background: pick(particle.backgrounds ?? ["none"], rnd) ?? "none",
  light: pick(particle.lights ?? ["center"], rnd) ?? "center",
  colorMix: pick(particle.colorMixes ?? ["mixed"], rnd) ?? "mixed",
  countScale: pick(particle.countScales ?? [1], rnd) ?? 1,
  sizeScale: pick(particle.sizeScales ?? [1], rnd) ?? 1,
  speedScale: pick(particle.speedScales ?? [1], rnd) ?? 1,
});

const cameraProfile = (camera, rnd, icons) => ({
  base: pick(camera.bases ?? [], rnd),
  post: pick(camera.posts ?? ["none"], rnd) ?? "none",
  grade: pick(camera.grades ?? [{}], rnd) ?? {},
  icons,
});

const transitionProfile = (transition, rnd) => ({
  angle: pick(transition.angles ?? [-12], rnd) ?? -12,
  intensity: pick(transition.intensities ?? [1], rnd) ?? 1,
});

export function pickVariation(workSeed, cfg = null) {
  const variation = readVariation(cfg);
  const rnd = makeRng(workSeed);
  const iconData = load(path.join(sharedRoot(cfg), "code", "icons.json"), {});
  const iconPoolName = pick(variation.camera?.iconPools ?? ["social"], rnd);
  const iconPool = iconData[iconPoolName] ?? iconData.social ?? [];
  const icons = shuffle(iconPool, rnd).slice(
    0,
    Math.min(iconPool.length, 4 + Math.floor(rnd() * 4)),
  );
  const palettes = variation.palettes ?? [];
  const profiles = variation.rhythmProfiles ?? [];
  const palette = palettes.length
    ? palettes[seedFrom(`${workSeed}:palette`) % palettes.length]
    : undefined;
  const rhythm = profiles.length
    ? profiles[seedFrom(`${workSeed}:rhythm`) % profiles.length]
    : null;

  const profile = {
    palette,
    text: textProfile(variation.text ?? {}, rnd),
    particle: particleProfile(variation.particle ?? {}, rnd),
    camera: cameraProfile(variation.camera ?? {}, rnd, icons),
    transition: transitionProfile(variation.transition ?? {}, rnd),
    durations: variation.durations ?? {},
    rhythm: rhythm ?? {
      name: "default",
      beats: [],
      generatedRatio: 0.3,
      overlayBias: 1,
      shotLength: { min: 1.4, max: 2.6 },
    },
  };
  profile.summary = {
    palette: profile.palette,
    textAlign: profile.text.align,
    textVertical: profile.text.vertical,
    textBackground: profile.text.background,
    textLight: profile.text.light,
    particleDistribution: profile.particle.distribution,
    particleBackground: profile.particle.background,
    particleColorMix: profile.particle.colorMix,
    cameraBase: profile.camera.base,
    cameraPost: profile.camera.post,
    transitionAngle: profile.transition.angle,
    transitionIntensity: profile.transition.intensity,
    rhythm: profile.rhythm.name,
  };
  return profile;
}

export function variationDuration(recipe, profile, workSeed) {
  const category = recipe.category ?? recipe.engine;
  const key = ["camera", "transition", "particle"].includes(category)
    ? category
    : "text";
  const list = profile.durations?.[key];
  if (!Array.isArray(list) || !list.length) return recipe.durationFrames;
  return list[seedFrom(`${workSeed}:${recipe.id}:duration`) % list.length];
}

const AXES = {
  text: [
    "align",
    "vertical",
    "background",
    "light",
    "letterSpacing",
    "lineHeight",
    "fontSize",
    "fontWeight",
    "maxWidth",
  ],
  particle: [
    "distribution",
    "background",
    "light",
    "colorMix",
    "countScale",
    "sizeScale",
    "speedScale",
  ],
  camera: ["post", "grade"],
  transition: ["angle", "intensity"],
};

export function applyVariation(recipe, props, profile, workSeed, index) {
  if (profile.palette) props.palette = profile.palette;
  props.seed =
    Math.floor(makeRng(workSeed + index * 101 + seedFrom(recipe.id))() * 1000000) +
    workSeed;

  const category = recipe.category ?? recipe.engine;
  const section = profile[category];

  if (section) {
    for (const key of AXES[category] ?? []) {
      if (section[key] !== undefined) props[key] = section[key];
    }
  }

  if (category === "text") {
    const { numbers, copy, keywords } = profile.text;
    if (numbers.length && "countTo" in props) {
      props.countTo =
        numbers[(seedFrom(`${workSeed}:${recipe.id}:number`) + index) % numbers.length];
    }
    if (copy.length && "text" in props) {
      const phrase =
        copy[(seedFrom(`${workSeed}:${recipe.id}:text`) + index) % copy.length];
      props.text = phrase;
      if ("keyword" in props && keywords.length) {
        props.keyword =
          keywords.find((keyword) => phrase.includes(keyword)) ?? keywords[0];
      }
    }
  }

  if (category === "particle") {
    props.count = Math.max(
      8,
      Math.round((props.count ?? 80) * profile.particle.countScale),
    );
    if (props.lines) {
      props.lines = Math.max(
        24,
        Math.round(props.lines * profile.particle.countScale),
      );
    }
  }

  if (category === "camera") {
    if (profile.camera.base) props.basePreset = profile.camera.base;
    if (profile.camera.icons?.length) {
      props.baseProps = {
        ...(props.baseProps ?? {}),
        icons: profile.camera.icons,
      };
    }
  }

  return props;
}
