#!/usr/bin/env node
import { loadConfig } from "../lib/config.mjs";
import { scanAll } from "./scanner.mjs";

try {
  const cfg = loadConfig(process.argv.slice(2));
  const { stats } = scanAll(cfg);
  if (cfg.flags.check && stats.new + stats.changed > 0) {
    console.error(
      `[scan] --check：发现 ${stats.new + stats.changed} 个新/变更素材，先处理或导入后再继续。`,
    );
    process.exit(2);
  }
  console.log("[scan] 下一步：node run.mjs generate");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
