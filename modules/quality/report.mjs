import { writeFileSync } from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "../lib/fsx.mjs";

const pct = (value) => `${Math.round(Number(value) * 1000) / 10}%`;

function layerTable(report) {
  const rows = Object.entries(report.layers)
    .map(([layer, item]) => ({
      layer,
      assets: item.assets,
      clusters: item.clusters,
      diversity: item.diversity,
      motion: item.avgMotionEnergy,
      alpha: item.avgAlphaCoverage,
      flagged: item.flagged,
    }))
    .sort((a, b) => a.layer.localeCompare(b.layer));
  return rows;
}

export function formatReport(report) {
  const lines = [];
  const s = report.summary;
  lines.push(
    `[quality] 素材 ${s.assets} / 已分析 ${s.analyzed} / 缺失 ${s.missing} / 感知簇 ${s.clusters} / 多样性 ${s.diversity} / 近似重复 ${s.nearDuplicates} / 质量标记 ${s.flagged} / 警告 ${s.warnings ?? 0}`,
  );
  lines.push(
    `[quality] 阈值 clusterDistance=${s.options.clusterDistance} similarity=${s.options.similarityThreshold} sampleFrames=${s.options.sampleFrames} phashSize=${s.options.phashSize}`,
  );

  lines.push("[quality] 按层：");
  lines.push("  layer       assets  clusters  diversity  avgMotion  avgAlpha  flagged");
  for (const row of layerTable(report)) {
    lines.push(
      `  ${row.layer.padEnd(11)} ${String(row.assets).padStart(6)}  ${String(row.clusters).padStart(8)}  ${String(row.diversity).padStart(9)}  ${String(row.motion).padStart(9)}  ${String(row.alpha).padStart(8)}  ${String(row.flagged).padStart(7)}`,
    );
  }

  if (report.nearDuplicates.length) {
    lines.push(
      `[quality] 近似重复（score >= ${s.options.similarityThreshold}，共 ${report.nearDuplicateTotal} 对）：`,
    );
    for (const pair of report.nearDuplicates) {
      lines.push(
        `  ${pair.layer.padEnd(10)} ${pair.a} ~ ${pair.b}  score=${pair.score} min=${pair.hammingMin} mean=${pair.hammingMean}`,
      );
    }
  } else {
    lines.push("[quality] 近似重复：无");
  }

  lines.push("[quality] 覆盖矩阵 palette × layer：");
  const matrix = report.matrices.paletteByLayer;
  lines.push(`  ${"palette".padEnd(12)}${matrix.cols.map((c) => c.padStart(11)).join("")}`);
  for (const row of matrix.rows) {
    lines.push(
      `  ${row.padEnd(12)}${matrix.cols
        .map((col) => String(matrix.cells[row][col]).padStart(11))
        .join("")}`,
    );
  }

  lines.push("[quality] 轴覆盖（distinct / normalized entropy）：");
  for (const [key, axis] of Object.entries(report.axes)) {
    const top = axis.values
      .slice(0, 5)
      .map((item) => `${item.value}:${item.count}`)
      .join(" ");
    lines.push(
      `  ${key.padEnd(15)} ${String(axis.distinct).padStart(2)} 值  ${pct(axis.normalized).padStart(6)}  ${top}`,
    );
  }

  if (report.flagged.length) {
    lines.push("[quality] 质量标记 / 警告：");
    for (const item of report.flagged) {
      lines.push(
        `  ${item.ok === false ? "[fail]" : "[warn]"} ${item.id}  [${item.flags.join(", ")}]  type=${item.category ?? "-"} alpha=${item.alphaCoverage} alphaEnd=${item.alphaEnd} endMotion=${item.endMotion} loop=${item.firstLastHamming}`,
      );
    }
  }
  if (report.missing.length) {
    lines.push(
      `[quality] 未分析 ${report.missing.length} 条：${report.missing.slice(0, 8).join(", ")}${
        report.missing.length > 8 ? " ..." : ""
      }`,
    );
  }
  return lines.join("\n");
}

function markdownMatrix(title, matrix, rowLabel, colLabel) {
  const lines = [`### ${title}`, "", `| ${rowLabel} \\ ${colLabel} | ${matrix.cols.join(" | ")} |`, `| ${["---", ...matrix.cols.map(() => "---")].join(" | ")} |`];
  for (const row of matrix.rows) {
    lines.push(
      `| ${row} | ${matrix.cols.map((col) => matrix.cells[row][col]).join(" | ")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function formatMarkdown(report) {
  const s = report.summary;
  const lines = [
    "# 生成素材质量与覆盖报告",
    "",
    `- 时间：${report.generatedAt}`,
    `- 素材：${s.assets} 条，已分析 ${s.analyzed}，缺失 ${s.missing}`,
    `- 感知簇：${s.clusters}，多样性 ${s.diversity}`,
    `- 近似重复：${report.nearDuplicateTotal} 对（score ≥ ${s.options.similarityThreshold}）`,
    `- 质量标记：${s.flagged}（警告 ${s.warnings ?? 0}）`,
    `- 参数：pHash ${s.options.phashSize}×${s.options.phashSize}，每段 ${s.options.sampleFrames} 帧，聚类 Hamming ≤ ${s.options.clusterDistance}`,
    "",
    "## 按层",
    "",
    "| 层 | 素材 | 簇 | 多样性 | 平均运动 | 平均 alpha | 标记 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of layerTable(report)) {
    lines.push(
      `| ${row.layer} | ${row.assets} | ${row.clusters} | ${row.diversity} | ${row.motion} | ${row.alpha} | ${row.flagged} |`,
    );
  }
  lines.push("");

  if (report.nearDuplicates.length) {
    lines.push("## 近似重复", "", "| 层 | A | B | score | min | mean |", "| --- | --- | --- | --- | --- | --- |");
    for (const pair of report.nearDuplicates) {
      lines.push(
        `| ${pair.layer} | ${pair.a} | ${pair.b} | ${pair.score} | ${pair.hammingMin} | ${pair.hammingMean} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 覆盖矩阵", "");
  lines.push(markdownMatrix("调色板 × 层", report.matrices.paletteByLayer, "palette", "layer"));
  lines.push(markdownMatrix("Recipe × 调色板", report.matrices.recipeByPalette, "recipe", "palette"));
  lines.push(markdownMatrix("引擎 × 层", report.matrices.engineByLayer, "engine", "layer"));
  lines.push(markdownMatrix("范围 × 层", report.matrices.scopeByLayer, "scope", "layer"));

  lines.push("## 轴覆盖", "", "| 轴 | 取值数 | 归一化熵 | 分布 |", "| --- | --- | --- | --- |");
  for (const [key, axis] of Object.entries(report.axes)) {
    const distribution = axis.values
      .map((item) => `${item.value}:${item.count}`)
      .join(", ");
    lines.push(
      `| ${key} | ${axis.distinct} | ${axis.normalized} | ${distribution} |`,
    );
  }
  lines.push("");

  if (report.flagged.length) {
    lines.push("## 质量标记 / 警告", "", "| 素材 | 类型 | 状态 | 标记 | alpha | alphaEnd | 末帧运动 | 首尾差异 |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const item of report.flagged) {
      lines.push(
        `| ${item.id} | ${item.category ?? "-"} | ${item.ok === false ? "fail" : "warn"} | ${item.flags.join(", ")} | ${item.alphaCoverage} | ${item.alphaEnd} | ${item.endMotion} | ${item.firstLastHamming} |`,
      );
    }
    lines.push("");
  }

  if (report.missing.length) {
    lines.push("## 未分析", "", report.missing.join(", "), "");
  }
  return `${lines.join("\n")}\n`;
}

export function writeReport(cfg, report) {
  const jsonFile = path.join(cfg.paths.data, "quality", "report.json");
  writeJson(jsonFile, report);
  const mdDir = path.join(cfg.paths.out, "quality");
  ensureDir(mdDir);
  const mdFile = path.join(mdDir, "report.md");
  writeFileSync(mdFile, formatMarkdown(report));
  return { jsonFile, mdFile };
}
