import { colorDistance, hammingHex, minHamming } from "../lib/vision.mjs";
import { qualityConfig } from "./analyze.mjs";

const variationValue = (asset, key, fallback = "n/a") =>
  asset.variation?.[key] ?? asset.variation?.summary?.[key] ?? fallback;

const paletteOf = (asset) =>
  asset.props?.palette ??
  asset.variation?.palette ??
  asset.variation?.summary?.palette ??
  "unknown";

const AXES = [
  { key: "layer", label: "层", value: (a) => a.layer ?? "scene" },
  {
    key: "category",
    label: "类型",
    value: (a) => a.category ?? a.quality?.category ?? a.layer ?? "scene",
  },
  { key: "series", label: "系列", value: (a) => a.series ?? "n/a" },
  { key: "scope", label: "范围", value: (a) => a.scope ?? "shared" },
  { key: "engine", label: "引擎", value: (a) => a.engine ?? "preset" },
  { key: "recipe", label: "Recipe", value: (a) => a.recipeId ?? "preset" },
  { key: "preset", label: "Preset", value: (a) => a.preset ?? "unknown" },
  { key: "palette", label: "调色板", value: paletteOf },
  {
    key: "textAlign",
    label: "文本对齐",
    value: (a) => variationValue(a, "textAlign"),
  },
  {
    key: "textBackground",
    label: "文本背景",
    value: (a) => variationValue(a, "textBackground"),
  },
  {
    key: "cameraBase",
    label: "镜头底图",
    value: (a) => variationValue(a, "cameraBase"),
  },
  {
    key: "cameraPost",
    label: "镜头后处理",
    value: (a) => variationValue(a, "cameraPost"),
  },
  {
    key: "rhythm",
    label: "节奏",
    value: (a) => variationValue(a, "rhythm"),
  },
  {
    key: "footageTheme",
    label: "素材主题",
    value: (a) => variationValue(a, "footageTheme"),
  },
];

/** 按比例对齐两段帧序列，返回平均 Hamming 距离。 */
export function alignedHamming(aFrames, bFrames) {
  if (!aFrames?.length || !bFrames?.length) return 64;
  const count = Math.max(aFrames.length, bFrames.length);
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const ia = Math.round((i * (aFrames.length - 1)) / Math.max(1, count - 1));
    const ib = Math.round((i * (bFrames.length - 1)) / Math.max(1, count - 1));
    sum += hammingHex(aFrames[ia], bFrames[ib]);
  }
  return sum / count;
}

export function pairMetrics(a, b) {
  const min = minHamming(a.quality?.phashFrames, b.quality?.phashFrames);
  const mean = alignedHamming(a.quality?.phashFrames, b.quality?.phashFrames);
  const color = colorDistance(a.quality?.avgColor, b.quality?.avgColor);
  const hashSim = 1 - (0.6 * mean + 0.4 * min) / 64;
  const score = 0.85 * hashSim + 0.15 * (1 - color);
  return {
    hammingMin: min,
    hammingMean: Number(mean.toFixed(2)),
    colorDistance: Number(color.toFixed(3)),
    score: Number(score.toFixed(4)),
  };
}

function makeUnionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x) => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    let node = x;
    while (parent[node] !== node) {
      const next = parent[node];
      parent[node] = root;
      node = next;
    }
    return root;
  };
  return {
    find,
    union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    },
  };
}

function assignClusters(assets, distance) {
  const uf = makeUnionFind(assets.length);
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < assets.length; j += 1) {
      const a = assets[i];
      const b = assets[j];
      if ((a.layer ?? "scene") !== (b.layer ?? "scene")) continue;
      const { hammingMean, score } = pairMetrics(a, b);
      if (hammingMean <= distance || score >= 0.9) uf.union(i, j);
    }
  }
  const groups = new Map();
  assets.forEach((asset, index) => {
    const root = uf.find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(asset);
  });
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
  const clusterOf = new Map();
  const clusters = sorted.map((members, index) => {
    const id = `c${String(index + 1).padStart(2, "0")}`;
    for (const member of members) clusterOf.set(member.id, id);
    return {
      id,
      layer: members[0].layer ?? "scene",
      size: members.length,
      members: members.map((member) => member.id),
    };
  });
  return { clusters, clusterOf };
}

function entropy(values) {
  if (!values.length) return { entropy: 0, normalized: 0 };
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / values.length;
    bits -= p * Math.log2(p);
  }
  const max = Math.log2(Math.max(2, counts.size));
  return {
    entropy: Number(bits.toFixed(3)),
    normalized: Number((max ? bits / max : 0).toFixed(3)),
    distinct: counts.size,
  };
}

function layerSummary(assets, clusterOf, clusterCount) {
  const total = assets.length;
  const diversity = total ? Number((1 - (total - clusterCount) / total).toFixed(3)) : 0;
  const motion = assets.map((a) => a.quality?.motionEnergy ?? 0);
  const alpha = assets
    .map((a) => a.quality?.alphaCoverage)
    .filter((value) => value != null);
  const avg = (list) =>
    list.length ? Number((list.reduce((sum, v) => sum + v, 0) / list.length).toFixed(4)) : 0;
  return {
    assets: total,
    clusters: clusterCount,
    diversity,
    avgMotionEnergy: avg(motion),
    avgAlphaCoverage: avg(alpha),
    flagged: assets.filter((a) => a.quality?.ok === false).length,
    ids: assets.map((a) => a.id),
    clusterIds: [...new Set(assets.map((a) => clusterOf.get(a.id)).filter(Boolean))],
  };
}

function buildMatrix(assets, rowOf, colOf) {
  const rows = [...new Set(assets.map(rowOf))].sort();
  const cols = [...new Set(assets.map(colOf))].sort();
  const cells = {};
  for (const row of rows) {
    cells[row] = {};
    for (const col of cols) cells[row][col] = 0;
  }
  for (const asset of assets) {
    cells[rowOf(asset)][colOf(asset)] += 1;
  }
  const flat = [];
  for (const row of rows) {
    for (const col of cols) flat.push(cells[row][col]);
  }
  return {
    rows,
    cols,
    cells,
    filled: flat.filter((value) => value > 0).length,
    total: flat.length,
    coverage: flat.length
      ? Number((flat.filter((value) => value > 0).length / flat.length).toFixed(3))
      : 0,
  };
}

export function buildReport(cfg, allAssets) {
  const options = qualityConfig(cfg);
  const assets = allAssets.filter(
    (asset) =>
      asset.status !== "retired" &&
      asset.quality?.phash &&
      Array.isArray(asset.quality.phashFrames) &&
      asset.quality.phashFrames.length,
  );
  const missing = allAssets.filter(
    (asset) => asset.status !== "retired" && !asset.quality?.phash,
  );

  const { clusters, clusterOf } = assignClusters(
    assets,
    options.clusterDistance,
  );

  const layers = {};
  for (const asset of assets) {
    const key = asset.layer ?? "scene";
    if (!layers[key]) layers[key] = [];
    layers[key].push(asset);
  }
  const layerStats = {};
  for (const [key, list] of Object.entries(layers)) {
    const count = new Set(list.map((asset) => clusterOf.get(asset.id))).size;
    layerStats[key] = layerSummary(list, clusterOf, count);
  }

  const nearDuplicates = [];
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < assets.length; j += 1) {
      const a = assets[i];
      const b = assets[j];
      if ((a.layer ?? "scene") !== (b.layer ?? "scene")) continue;
      const metrics = pairMetrics(a, b);
      if (metrics.score >= options.similarityThreshold) {
        nearDuplicates.push({
          a: a.id,
          b: b.id,
          layer: a.layer ?? "scene",
          ...metrics,
        });
      }
    }
  }
  nearDuplicates.sort((x, y) => y.score - x.score || y.hammingMin - x.hammingMin);

  const axes = {};
  for (const axis of AXES) {
    const values = new Map();
    for (const asset of assets) {
      const value = String(axis.value(asset));
      if (!values.has(value)) {
        values.set(value, { value, count: 0, clusters: new Set(), assets: [] });
      }
      const item = values.get(value);
      item.count += 1;
      item.assets.push(asset.id);
      item.clusters.add(clusterOf.get(asset.id));
    }
    const list = [...values.values()].map((item) => ({
      value: item.value,
      count: item.count,
      share: Number((item.count / assets.length).toFixed(3)),
      clusters: item.clusters.size,
      assets: item.assets,
    }));
    list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    axes[axis.key] = {
      label: axis.label,
      ...entropy(assets.map((asset) => String(axis.value(asset)))),
      values: list,
    };
  }

  const matrices = {
    paletteByLayer: buildMatrix(
      assets,
      paletteOf,
      (asset) => asset.layer ?? "scene",
    ),
    recipeByPalette: buildMatrix(
      assets.filter((asset) => asset.recipeId),
      (asset) => asset.recipeId,
      paletteOf,
    ),
    engineByLayer: buildMatrix(
      assets,
      (asset) => asset.engine ?? "preset",
      (asset) => asset.layer ?? "scene",
    ),
    scopeByLayer: buildMatrix(
      assets,
      (asset) => asset.scope ?? "shared",
      (asset) => asset.layer ?? "scene",
    ),
  };

  const flagged = assets
    .filter((asset) => (asset.quality?.flags ?? []).length)
    .map((asset) => ({
      id: asset.id,
      layer: asset.layer ?? "scene",
      category: asset.category ?? asset.quality?.category ?? null,
      series: asset.series ?? null,
      ok: asset.quality.ok,
      flags: asset.quality.flags,
      alphaCoverage: asset.quality.alphaCoverage,
      alphaEnd: asset.quality.alphaEnd,
      motionEnergy: asset.quality.motionEnergy,
      endMotion: asset.quality.endMotion,
      firstLastHamming: asset.quality.firstLastHamming,
      contrast: asset.quality.contrast,
    }));

  const clusterCount = clusters.length;
  const summary = {
    assets: allAssets.filter((asset) => asset.status !== "retired").length,
    analyzed: assets.length,
    missing: missing.length,
    clusters: clusterCount,
    diversity: assets.length
      ? Number((1 - (assets.length - clusterCount) / assets.length).toFixed(3))
      : 0,
    nearDuplicates: nearDuplicates.length,
    flagged: assets.filter((asset) => asset.quality?.ok === false).length,
    warnings: flagged.length,
    options: {
      clusterDistance: options.clusterDistance,
      similarityThreshold: options.similarityThreshold,
      sampleFrames: options.sampleFrames,
      phashSize: options.phashSize,
    },
  };

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary,
    layers: layerStats,
    axes,
    matrices,
    clusters,
    nearDuplicates: nearDuplicates.slice(0, options.maxSimilarityPairs),
    nearDuplicateTotal: nearDuplicates.length,
    flagged,
    missing: missing.map((asset) => asset.id),
  };
}
