import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib/fsx.mjs";
import { ensurePublicLinks } from "../lib/public.mjs";
import { renderStill } from "../lib/render.mjs";
import {
  stillFrames,
  writeCatalog,
} from "../generate/catalog.mjs";
import { renderAsset } from "../generate/render.mjs";
import { analyzeEntries } from "../quality/analyze.mjs";
import { compileSelection } from "./compile.mjs";
import { registryStatus, writeRegistry } from "./registry.mjs";

const now = () => new Date().toISOString();

export function readCatalogAssets(cfg) {
  const file = path.join(cfg.paths.data, "catalog.json");
  return readJson(file, { version: 1, assets: [] }).assets ?? [];
}

export function syncCatalog(
  cfg,
  entries,
  scopes,
  { prune = false, itemScoped = false } = {},
) {
  const file = path.join(cfg.paths.data, "catalog.json");
  const catalog = readJson(file, { version: 1, assets: [] });
  const assets = catalog.assets ?? [];
  const builtIds = new Set(entries.map((entry) => entry.id));
  const builtItems = new Set(
    entries.map(
      (entry) => `${entry.creativeId}/${entry.variantId}/${entry.itemId}`,
    ),
  );
  const timestamp = now();
  const byScope = new Map();
  for (const entry of entries) {
    const key = `${entry.creativeId}/${entry.variantId}`;
    if (!byScope.has(key)) byScope.set(key, []);
    byScope.get(key).push(entry.id);
  }

  const dropped = new Set();
  for (const asset of assets) {
    if (!asset.creativeId || !asset.variantId) continue;
    const key = `${asset.creativeId}/${asset.variantId}`;
    if (!scopes.has(key) || builtIds.has(asset.id)) continue;
    if (itemScoped) {
      const itemKey = `${asset.creativeId}/${asset.variantId}/${asset.itemId}`;
      if (!builtItems.has(itemKey)) continue;
    }
    if (asset.status === "retired" && !prune) continue;
    if (prune) {
      dropped.add(asset.id);
      for (const filePath of [
        asset.fileMp4,
        asset.fileWebm,
        asset.propsMp4File,
        asset.propsWebmFile,
        ...(asset.stills ?? []),
      ].filter(Boolean)) {
        try {
          unlinkSync(filePath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.warn(`[creative] 无法删除 ${filePath}：${error.message}`);
          }
        }
      }
      continue;
    }
    asset.status = "retired";
    asset.retiredAt = timestamp;
    asset.retiredReason = "creative-superseded";
    asset.supersededBy = byScope.get(key) ?? [];
  }

  const next = assets.filter((asset) => !dropped.has(asset.id));
  const indexById = new Map(next.map((asset, index) => [asset.id, index]));
  for (const entry of entries) {
    const index = indexById.get(entry.id);
    if (index === undefined) {
      next.push(entry);
      indexById.set(entry.id, next.length - 1);
      continue;
    }
    const old = next[index];
    next[index] = {
      ...entry,
      status: old.status ?? entry.status,
      approvedAt: old.approvedAt,
      rejectedAt: old.rejectedAt,
      quality: entry.quality === null ? null : (old.quality ?? entry.quality),
      usage: old.usage ?? entry.usage,
      scope: old.scope ?? entry.scope,
      workId: old.workId ?? entry.workId,
      workSeed: old.workSeed ?? entry.workSeed,
      sharedAt: old.sharedAt ?? entry.sharedAt,
      firstSeen: old.firstSeen,
    };
  }

  writeCatalog(cfg, next);
  return { catalog: next, file, retired: assets.length - next.length };
}

function writeBuildState(cfg, entries) {
  const file = path.join(cfg.paths.data, "creative", "build-state.json");
  const state = readJson(file, { version: 1, creatives: {} });
  state.version = 1;
  state.generatedAt = now();
  state.creatives = state.creatives ?? {};

  const byScope = new Map();
  for (const entry of entries) {
    const key = `${entry.creativeId}/${entry.variantId}`;
    if (!byScope.has(key)) {
      byScope.set(key, {
        creativeId: entry.creativeId,
        variantId: entry.variantId,
        creativeVersion: entry.creativeVersion,
        variantVersion: entry.variantVersion,
        assetIds: [],
        paramsHashes: {},
      });
    }
    const item = byScope.get(key);
    item.assetIds.push(entry.id);
    item.paramsHashes[entry.id] = entry.paramsHash;
  }

  for (const item of byScope.values()) {
    const creative = state.creatives[item.creativeId] ?? { variants: {} };
    creative.version = item.creativeVersion;
    creative.variants = creative.variants ?? {};
    creative.variants[item.variantId] = {
      version: item.variantVersion,
      builtAt: now(),
      assetIds: item.assetIds,
      paramsHashes: item.paramsHashes,
    };
    state.creatives[item.creativeId] = creative;
  }

  writeJson(file, state);
  return file;
}

export function buildCreatives(
  cfg,
  {
    creativeId = null,
    variantId = null,
    item = null,
    force = false,
    dryRun = false,
    prune = false,
    log = console.log,
  } = {},
) {
  const status = registryStatus(cfg);
  if (!status.ok) {
    writeRegistry(cfg);
    log(`[creative] 注册表已更新：${status.reason}`);
  }

  const { entries, projects } = compileSelection(cfg, {
    creativeId,
    variantId,
    item,
    dryRun,
    log,
  });

  if (!entries.length) {
    log("[creative] 没有可构建的素材");
    return { entries, rendered: 0, failed: 0, analyzed: 0, projects };
  }

  if (dryRun) {
    for (const entry of entries) {
      log(
        `[creative] dry-run ${entry.id} (${entry.preset}, ${entry.layer}, ${entry.duration}s, ${entry.status})`,
      );
    }
    return { entries, rendered: 0, failed: 0, analyzed: 0, projects };
  }

  ensurePublicLinks(cfg);
  let rendered = 0;
  let failed = 0;
  const successful = [];
  for (const entry of entries) {
    try {
      const count = renderAsset(cfg, entry, {
        force,
        logPrefix: "[creative]",
      });
      rendered += count;
      if (count) entry.quality = null;
      if (existsSync(entry.fileMp4)) successful.push(entry);
    } catch (error) {
      failed += 1;
      console.error(`[creative] 失败 ${entry.id}：${error.message}`);
    }
  }

  const scopes = new Set(
    successful.map((entry) => `${entry.creativeId}/${entry.variantId}`),
  );
  const { catalog } = syncCatalog(cfg, successful, scopes, {
    prune,
    itemScoped: item !== null && item !== undefined,
  });

  let analyzed = 0;
  if (cfg.creative?.autoQuality !== false) {
    const quality = analyzeEntries(cfg, catalog, { logPrefix: "[creative]" });
    analyzed = quality.analyzed;
    if (analyzed) writeCatalog(cfg, catalog);
  }

  const stateFile = writeBuildState(cfg, successful);
  log(
    `[creative] ${successful.length} 条素材 / 本次渲染 ${rendered} 个文件 / 失败 ${failed} / 质量分析 ${analyzed} / 状态 ${path.relative(cfg.paths.repo, stateFile)}`,
  );
  return { entries, rendered, failed, analyzed, projects, catalog };
}

export function previewCreatives(
  cfg,
  { creativeId, variantId = null, item = null, frame = null } = {},
) {
  const { entries } = compileSelection(cfg, {
    creativeId,
    variantId,
    item,
    dryRun: true,
  });
  ensurePublicLinks(cfg);
  const files = [];
  for (const entry of entries) {
    const outDir = path.join(
      cfg.paths.out,
      "creatives",
      entry.creativeId,
      entry.variantId,
    );
    mkdirSync(outDir, { recursive: true });
    const frames = frame === null ? stillFrames(entry) : [Number(frame)];
    for (const value of frames) {
      const out = path.join(outDir, `${entry.id}-f${value}.png`);
      renderStill({
        composition: "PipelineAsset",
        frame: value,
        out,
        props: {
          preset: entry.preset,
          props: entry.props,
          alpha: false,
          durationInFrames: entry.durationInFrames,
          fps: entry.fps,
          width: entry.width,
          height: entry.height,
        },
      });
      files.push(out);
    }
  }
  return files;
}

export function planCreatives(cfg, options = {}) {
  const { entries } = compileSelection(cfg, {
    ...options,
    dryRun: true,
  });
  return entries;
}
