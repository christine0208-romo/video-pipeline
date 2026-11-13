#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import { reindexCatalog } from "../modules/generate/catalog.mjs";

const cfg = loadConfig(process.argv.slice(2));
const apply = process.argv.includes("--apply");
const report = reindexCatalog(cfg, { apply });

const dir = path.join(cfg.paths.data, "migrations");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(
  path.join(dir, `reindex-${stamp}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(`[reindex] 实际文件 ${report.inventory}`);
console.log(`[reindex] 保留条目 ${report.kept}（沿用旧状态 ${report.preserved}，新增孤儿 ${report.orphans.length}）`);
console.log(`[reindex] 丢弃失效条目 ${report.dropped.length}`);
for (const item of report.orphans) console.log(`  + 新登记（draft）：${item}`);
for (const item of report.dropped.slice(0, 30)) console.log(`  - ${item.reason}：${item.id}`);
if (report.dropped.length > 30) console.log(`  ... 其余 ${report.dropped.length - 30} 条见迁移报告`);
if (!apply) console.log("[reindex] dry-run；加 --apply 才会写回 data/catalog.json。");
