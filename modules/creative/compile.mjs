import { shortHash } from "../lib/fsx.mjs";
import { makeEntry } from "../generate/catalog.mjs";
import {
  applyVariation,
  variationDuration,
} from "../generate/variation.mjs";
import { validateAll, projectEngine } from "./loader.mjs";
import { resolveParams, styleOf } from "./params.mjs";

const ALL_BEAT_ROLES = ["hook", "build", "proof", "turn", "close"];

const PROJECT_ASSET_PREFIX = "project/";

/**
 * 工程自带素材：参数里写 `project/...`，编译时解析成 public 下的
 * `creative/<id>/assets/...`。公共素材继续写 `assets/...`。
 */
export function resolveProjectAssets(value, creativeId) {
  if (typeof value === "string") {
    return value.startsWith(PROJECT_ASSET_PREFIX)
      ? `creative/${creativeId}/assets/${value.slice(PROJECT_ASSET_PREFIX.length)}`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveProjectAssets(item, creativeId));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveProjectAssets(item, creativeId),
      ]),
    );
  }
  return value;
}

const presetMetaOf = (engine) => ({
  id: engine.preset,
  supportsAlpha: Boolean(engine.alpha),
  description: engine.label ?? engine.preset,
  category: engine.category,
  loop: Boolean(engine.loop),
  complete: engine.complete ?? undefined,
});

export function compileProject(
  cfg,
  project,
  engine,
  {
    variantId = null,
    dryRun = false,
    log = null,
    scope = "shared",
    workId = null,
    workSeed = null,
    profile = null,
    idPrefix = "",
    itemFilter = null,
  } = {},
) {
  const presetMeta = presetMetaOf(engine);

  const entries = [];
  for (const variant of project.variants) {
    if (variantId && variant.id !== variantId) continue;
    if (variant.enabled === false) continue;
    if ((variant.status ?? "draft") === "retired") continue;

    const style = styleOf(engine, variant.style);
    const items = variant.items ?? [];
    const creativeVersion = Number(project.version ?? 1);
    const variantVersion = Number(variant.version ?? 1);
    const recipe = {
      id: `${project.id}-${variant.id}`,
      engine: engine.id,
      category: engine.category,
      preset: engine.preset,
      code: style.code,
    };

    for (const [index, item] of items.entries()) {
      if (itemFilter && !itemFilter({ project, variant, index, item })) {
        continue;
      }
      const errors = [];
      const warnings = [];
      let props = resolveParams({
        engine,
        styleId: variant.style,
        layers: [project.params, variant.params, item?.params],
        location: `${project.id}/${variant.id}[${index}]`,
        errors,
        warnings,
      });
      if (errors.length) throw new Error(errors.join("\n"));
      for (const warning of warnings) log?.(`[creative] 警告 ${warning}`);
      props = resolveProjectAssets(props, project.id);

      let durationFrames = variant.durationFrames ?? style.durationFrames;
      if (profile) {
        props = applyVariation(recipe, props, profile, workSeed, index);
        durationFrames = variationDuration(recipe, profile, workSeed);
      }

      const idHash = shortHash(
        JSON.stringify({
          props,
          creativeVersion,
          variantVersion,
          code: style.code,
          ...(workId ? { workId } : {}),
        }),
        6,
      );

      entries.push(
        makeEntry({
          cfg: dryRun
            ? { ...cfg, flags: { ...cfg.flags, "dry-run": true } }
            : cfg,
          presetMeta,
          preset: engine.preset,
          props,
          index,
          idBase: `${idPrefix}${project.id}-${variant.id}`,
          source: {
            kind: "creative",
            creativeId: project.id,
            variantId: variant.id,
            creativeVersion,
            variantVersion,
            style: variant.style,
            code: style.code,
            prompt: style.prompt ?? variant.name ?? project.name,
            version: creativeVersion,
            file: project.file,
            ...(workId ? { workId, workSeed } : {}),
          },
          layer: engine.layer,
          beatRoles:
            variant.beatRoles ?? style.beatRoles ?? ALL_BEAT_ROLES,
          category: engine.category,
          series: project.id,
          seriesIndex: index,
          complete: engine.complete ?? null,
          status: scope === "work" ? "approved" : (variant.status ?? "draft"),
          engine: engine.id,
          version: creativeVersion,
          alpha: engine.alpha,
          durationFrames,
          loop: variant.loop ?? engine.loop,
          tags: {
            creativeId: project.id,
            variantId: variant.id,
            style: variant.style,
            code: style.code,
            layer: engine.layer,
            engine: engine.id,
            ...(workId ? { workId } : {}),
          },
          labels: [
            `creative:${project.id}`,
            `variant:${variant.id}`,
            `style:${variant.style}`,
            `code:${style.code}`,
            `layer:${engine.layer}`,
            `engine:${engine.id}`,
            `creative-v:${creativeVersion}`,
            `palette:${props.palette}`,
            ...(workId ? [`work:${workId}`] : []),
          ],
          description: variant.name ?? project.name,
          creativeId: project.id,
          variantId: variant.id,
          creativeVersion,
          variantVersion,
          creativeStyle: variant.style,
          paramsHash: idHash,
          idHash,
          scope,
          workId,
          workSeed,
          variation: profile?.summary ?? null,
        }),
      );
      entries[entries.length - 1].itemId = item?.id ?? String(index + 1);
    }
  }

  return entries;
}

export function itemMatcher(ref) {
  if (ref === null || ref === undefined || ref === "") return null;
  const value = String(ref);
  const numeric = /^\d+$/.test(value) ? Number(value) : null;
  return ({ item, index }) => {
    const id = item?.id === undefined || item?.id === null ? "" : String(item.id);
    if (id && id === value) return true;
    if (numeric !== null) return index === numeric || index + 1 === numeric;
    return false;
  };
}

export function compileSelection(
  cfg,
  {
    creativeId = null,
    variantId = null,
    item = null,
    dryRun = false,
    log = null,
  } = {},
) {
  const { engines, projects, errors } = validateAll(cfg);
  if (errors.length) throw new Error(errors.join("\n"));

  const selected = creativeId
    ? projects.filter((project) => project.id === creativeId)
    : projects;
  if (creativeId && !selected.length) {
    throw new Error(`创意工程不存在：${creativeId}`);
  }

  const itemFilter = itemMatcher(item);
  const entries = [];
  for (const project of selected) {
    const engine = projectEngine(project, engines);
    entries.push(
      ...compileProject(cfg, project, engine, {
        variantId,
        dryRun,
        log,
        itemFilter,
      }),
    );
  }
  if (variantId && !entries.length) {
    throw new Error(`变体没有可编译的 item：${variantId}`);
  }
  if (item !== null && item !== undefined && !entries.length) {
    throw new Error(`没有找到 item：${item}`);
  }
  return { entries, projects: selected, engines };
}
