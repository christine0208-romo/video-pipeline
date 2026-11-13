import path from "node:path";
import { PIPELINE_ROOT } from "../lib/config.mjs";
import { readJson } from "../lib/fsx.mjs";
import { makeRng, seedFrom, shuffle } from "../lib/rng.mjs";

const CACHE = new Map();

function load(file, fallback) {
  if (!CACHE.has(file)) CACHE.set(file, readJson(file, fallback));
  return CACHE.get(file);
}

export function readVariation() {
  return load(
    path.join(PIPELINE_ROOT, "src", "generated", "variation.json"),
    {
      palettes: ["aurora"],
      text: {},
      particle: {},
      camera: {},
      transition: {},
      durations: {},
      rhythmProfiles: [],
      footageThemes: [],
    },
  );
}

const pick = (list, rnd) =>
  list.length ? list[Math.floor(rnd() * list.length)] : undefined;

const textProfile = (text, rnd) => ({
  align: pick(text.aligns ?? ["center"], rnd) ?? "center",
  vertical: pick(text.verticals ?? ["center"], rnd) ?? "center",
  background: pick(text.backgrounds ?? ["none"], rnd) ?? "none",
  light: pick(text.lights ?? ["center"], rnd) ?? "center",
  letterSpacing:
    pick(text.letterSpacings ?? [0.02], rnd) ?? 0.02,
  lineHeight: pick(text.lineHeights ?? [1.15], rnd) ?? 1.15,
  fontSize: pick(text.fontSizes ?? [96], rnd) ?? 96,
  fontWeight: pick(text.fontWeights ?? [900], rnd) ?? 900,
  maxWidth: pick(text.maxWidths ?? [920], rnd) ?? 920,
  copy: text.copy ?? ["连接，从这里开始"],
  keywords: text.keywords ?? ["连接"],
  numbers: text.numbers ?? [100],
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
  base: pick(camera.bases ?? ["platform-orbit"], rnd) ?? "platform-orbit",
  post: pick(camera.posts ?? ["none"], rnd) ?? "none",
  grade: pick(camera.grades ?? [{}], rnd) ?? {},
  icons,
});

const transitionProfile = (transition, rnd) => ({
  angle: pick(transition.angles ?? [-12], rnd) ?? -12,
  intensity: pick(transition.intensities ?? [1], rnd) ?? 1,
});

export function pickVariation(workSeed) {
  const variation = readVariation();
  const rnd = makeRng(workSeed);
  const assets = load(
    path.join(PIPELINE_ROOT, "src", "generated", "assets.json"),
    {},
  );
  const iconPoolName = pick(
    variation.camera?.iconPools ?? ["social"],
    rnd,
  );
  const iconPool = assets[iconPoolName] ?? assets.social ?? [];
  const icons = shuffle(iconPool, rnd).slice(
    0,
    Math.min(iconPool.length, 4 + Math.floor(rnd() * 4)),
  );
  const palettes = variation.palettes ?? ["aurora"];
  const profiles = variation.rhythmProfiles ?? [];
  const themes = variation.footageThemes ?? [];
  const palette =
    palettes[seedFrom(`${workSeed}:palette`) % palettes.length] ?? "aurora";
  const rhythm = profiles.length
    ? profiles[seedFrom(`${workSeed}:rhythm`) % profiles.length]
    : null;
  const footageTheme = themes.length
    ? themes[seedFrom(`${workSeed}:theme`) % themes.length]
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
    footageTheme: footageTheme ?? { name: "mixed", tags: [] },
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
    footageTheme: profile.footageTheme.name,
  };
  return profile;
}

export function variationDuration(recipe, profile, workSeed) {
  const key =
    recipe.engine === "camera"
      ? "camera"
      : recipe.engine === "transition"
        ? "transition"
        : recipe.engine === "particle"
          ? "particle"
          : "text";
  const list = profile.durations?.[key];
  if (!Array.isArray(list) || !list.length) return recipe.durationFrames;
  return list[seedFrom(`${workSeed}:${recipe.id}:duration`) % list.length];
}

export function applyVariation(recipe, props, profile, workSeed, index) {
  props.palette = profile.palette;
  props.seed =
    Math.floor(makeRng(workSeed + index * 101 + seedFrom(recipe.id))() * 1000000) +
    workSeed;

  if (recipe.engine === "text" || recipe.preset === "text-atom") {
    Object.assign(props, {
      align: profile.text.align,
      vertical: profile.text.vertical,
      background: profile.text.background,
      light: profile.text.light,
      letterSpacing: profile.text.letterSpacing,
      lineHeight: profile.text.lineHeight,
      fontSize: profile.text.fontSize,
      fontWeight: profile.text.fontWeight,
      maxWidth: profile.text.maxWidth,
    });
    if (recipe.code === "T08") {
      const numbers = profile.text.numbers;
      props.countTo =
        numbers[(seedFrom(`${workSeed}:${recipe.id}:number`) + index) % numbers.length];
    } else {
      const copy = profile.text.copy;
      const phrase =
        copy[(seedFrom(`${workSeed}:${recipe.id}:text`) + index) % copy.length];
      props.text = phrase;
      if (recipe.code === "T06") {
        props.keyword =
          profile.text.keywords.find((keyword) => phrase.includes(keyword)) ??
          profile.text.keywords[0];
      }
    }
  }

  if (recipe.engine === "particle" || recipe.preset === "particle-atom") {
    Object.assign(props, {
      distribution: profile.particle.distribution,
      background: profile.particle.background,
      light: profile.particle.light,
      colorMix: profile.particle.colorMix,
      countScale: profile.particle.countScale,
      sizeScale: profile.particle.sizeScale,
      speedScale: profile.particle.speedScale,
    });
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

  if (recipe.engine === "camera" || recipe.preset === "camera-scene") {
    props.basePreset = profile.camera.base;
    props.baseProps = {
      ...(props.baseProps ?? {}),
      icons: profile.camera.icons,
    };
    props.post = profile.camera.post;
    props.grade = profile.camera.grade;
  }

  if (recipe.engine === "transition" || recipe.preset === "transition-atom") {
    props.angle = profile.transition.angle;
    props.intensity = profile.transition.intensity;
  }

  return props;
}
