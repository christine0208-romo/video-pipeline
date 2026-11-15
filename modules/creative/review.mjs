import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { normalizeWorkId, readJson, writeJson } from "../lib/fsx.mjs";
import { removeOutputFromRegistry } from "../mix/uniqueness.mjs";

const splitIds = (value) =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const statusOf = (asset) => asset.status ?? "approved";
const scopeOf = (asset) => asset.scope ?? "shared";

const assetFiles = (asset) =>
  [
    asset.fileMp4,
    asset.fileWebm,
    asset.propsMp4File,
    asset.propsWebmFile,
    ...(asset.stills ?? []),
  ].filter(Boolean);

const fileBytes = (asset) =>
  assetFiles(asset).reduce((sum, file) => {
    try {
      return sum + statSync(file).size;
    } catch {
      return sum;
    }
  }, 0);

const edlDir = (cfg) => path.join(cfg.paths.data, "edl");

const edlReferences = (cfg, ids) => {
  const set = new Set(ids);
  const dir = edlDir(cfg);
  if (!existsSync(dir)) return [];
  const refs = [];
  for (const file of readdirSync(dir).filter(
    (name) =>
      name.endsWith(".json") &&
      !name.endsWith(".props.json") &&
      name !== "signatures.json",
  )) {
    const edl = readJson(path.join(dir, file), null);
    if (!edl?.beats) continue;
    const found = new Set();
    for (const beat of edl.beats) {
      for (const shot of beat.shots ?? []) {
        for (const id of [
          shot.assetId,
          shot.overlay?.assetId,
          shot.transitionAsset?.assetId,
        ]) {
          if (id && set.has(id)) found.add(id);
        }
      }
    }
    if (found.size) refs.push(`${file}(${found.size})`);
  }
  return refs;
};

const listWorks = (cfg, assets) => {
  const works = new Map();
  for (const asset of assets) {
    if (!asset.workId) continue;
    const item = works.get(asset.workId) ?? {
      workId: asset.workId,
      assets: 0,
      layers: new Set(),
      shared: 0,
      bytes: 0,
    };
    if (scopeOf(asset) === "work") {
      item.assets += 1;
      item.layers.add(asset.layer);
      item.bytes += fileBytes(asset);
    } else {
      item.shared += 1;
    }
    works.set(asset.workId, item);
  }

  console.log("work\tassets\tlayers\tshared\tedl\toutput\tbytes");
  for (const item of [...works.values()].sort((a, b) =>
    a.workId.localeCompare(b.workId),
  )) {
    const edl = existsSync(
      path.join(edlDir(cfg), `${item.workId}.json`),
    );
    const output = existsSync(path.join(cfg.paths.out, `${item.workId}.mp4`));
    console.log(
      `${item.workId}\t${item.assets}\t${[...item.layers].join(",")}\t${
        item.shared
      }\t${edl ? "yes" : "no"}\t${output ? "yes" : "no"}\t${item.bytes}`,
    );
  }
  console.log(`[review] 共 ${works.size} 个 work`);
};

const cleanWork = (cfg, catalog, catalogFile) => {
  const workId = normalizeWorkId(cfg.flags["clean-work"]);
  const workAssets = catalog.assets.filter(
    (asset) => scopeOf(asset) === "work" && asset.workId === workId,
  );
  const sharedAssets = catalog.assets.filter(
    (asset) => scopeOf(asset) === "shared" && asset.workId === workId,
  );
  const force = Boolean(cfg.flags.force);
  const refs = edlReferences(
    cfg,
    workAssets.map((asset) => asset.id),
  );

  console.log(
    `[review] work ${workId}：${workAssets.length} 条 work 素材，${sharedAssets.length} 条已提升 shared`,
  );
  for (const asset of workAssets) {
    console.log(
      `  ${asset.id}\t${asset.layer}\t${
        (asset.stills ?? [])
          .map((still) => path.relative(cfg.paths.repo, still))
          .join(", ") || "-"
      }`,
    );
  }
  if (refs.length) {
    console.warn(`[review] 以下 EDL 仍引用这些素材：${refs.join(", ")}`);
  }
  if (!force) {
    console.log("[review] dry-run：加 --force 才删除 work 素材");
    return 0;
  }
  if (sharedAssets.length) {
    console.log(
      `[review] 保留 ${sharedAssets.length} 条已提升 shared 素材`,
    );
  }

  for (const asset of workAssets) {
    for (const file of assetFiles(asset)) {
      try {
        unlinkSync(file);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.warn(`[review] 无法删除 ${file}：${error.message}`);
        }
      }
    }
  }

  const removed = new Set(workAssets.map((asset) => asset.id));
  writeJson(catalogFile, {
    ...catalog,
    assets: catalog.assets.filter((asset) => !removed.has(asset.id)),
    reviewedAt: new Date().toISOString(),
  });

  const registryFile = path.join(edlDir(cfg), "signatures.json");
  const registry = readJson(registryFile, null);
  if (registry) {
    removeOutputFromRegistry(registry, workId);
    writeJson(registryFile, registry);
  }

  console.log(`[review] 已删除 ${workAssets.length} 条 work 素材`);
  return 0;
};

export function reviewCatalog(cfg) {
  const file = path.join(cfg.paths.data, "catalog.json");
  const catalog = readJson(file, null);
  if (!catalog?.assets?.length) {
    console.error("[review] 目录为空：先运行 node run.mjs creative build");
    return 1;
  }

  const assets = catalog.assets;
  let changed = false;

  if (cfg.flags["list-works"]) {
    listWorks(cfg, assets);
    return 0;
  }
  if (cfg.flags["clean-work"]) {
    return cleanWork(cfg, catalog, file);
  }

  const targets = (flag) => {
    const ids = splitIds(flag);
    if (ids[0] === "all") {
      return assets.filter((asset) => statusOf(asset) === "draft");
    }
    return assets.filter((asset) => ids.includes(asset.id));
  };

  if (cfg.flags.approve) {
    const list = targets(cfg.flags.approve);
    if (!list.length) console.warn("[review] 没有匹配的资产可 approve");
    for (const asset of list) {
      asset.status = "approved";
      asset.approvedAt = new Date().toISOString();
      delete asset.rejectedAt;
      changed = true;
    }
    console.log(`[review] approved ${list.length} 条`);
  }

  if (cfg.flags.reject) {
    const list = targets(cfg.flags.reject);
    if (!list.length) console.warn("[review] 没有匹配的资产可 reject");
    for (const asset of list) {
      asset.status = "retired";
      asset.rejectedAt = new Date().toISOString();
      changed = true;
    }
    console.log(`[review] retired ${list.length} 条`);
  }

  if (cfg.flags.share) {
    const raw = String(cfg.flags.share);
    let list = [];
    if (raw.startsWith("all-work:")) {
      const workId = normalizeWorkId(raw.slice("all-work:".length));
      list = assets.filter(
        (asset) => scopeOf(asset) === "work" && asset.workId === workId,
      );
    } else {
      const ids = splitIds(raw);
      list = assets.filter(
        (asset) => ids.includes(asset.id) && scopeOf(asset) === "work",
      );
    }
    for (const asset of list) {
      asset.scope = "shared";
      asset.sharedAt = new Date().toISOString();
      asset.status = "approved";
      changed = true;
    }
    if (!list.length) {
      console.warn("[review] 没有匹配的 work 素材可提升");
    }
    console.log(`[review] shared ${list.length} 条`);
  }

  if (changed) {
    writeJson(file, { ...catalog, reviewedAt: new Date().toISOString() });
  }

  if (cfg.flags.review || cfg.flags.list || !changed) {
    const statusFilter = cfg.flags.status ? String(cfg.flags.status) : null;
    const rows = statusFilter
      ? assets.filter((asset) => statusOf(asset) === statusFilter)
      : assets;
    console.log("status\tscope\twork\tlayer\tid\tcode\tduration\tstills");
    for (const asset of rows) {
      const stills = (asset.stills ?? [])
        .map((still) => path.relative(cfg.paths.repo, still))
        .join(", ");
      const work =
        scopeOf(asset) === "work"
          ? asset.workId
          : asset.sharedAt
            ? `shared:${asset.workId ?? ""}`
            : "-";
      console.log(
        `${statusOf(asset)}\t${scopeOf(asset)}\t${work}\t${
          asset.layer ?? "scene"
        }\t${asset.id}\t${asset.source?.code ?? asset.preset}\t${
          asset.duration
        }s\t${stills}`,
      );
    }
    console.log(
      `[review] 共 ${rows.length} 条；approve/reject/share 用 --approve / --reject / --share <id,...>`,
    );
  }

  return 0;
}
