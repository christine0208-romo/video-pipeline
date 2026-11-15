#!/usr/bin/env node
import { loadConfig } from "../lib/config.mjs";
import { scanAll } from "./scanner.mjs";

try {
  const cfg = loadConfig(process.argv.slice(2));
  const { stats } = scanAll(cfg);
  if (stats.intentionalEmpty) {
    console.log("[scan] intentionalEmpty=true：配置的素材根都不存在，素材库已重置为空。");
  }
  if (cfg.flags.check && stats.new + stats.changed > 0) {
    console.error(
      `[scan] --check：发现 ${stats.new + stats.changed} 个新/变更素材，先处理或导入后再继续。`,
    );
    process.exit(2);
  }
  console.log("[scan] 下一步：node run.mjs sync --apply  →  node run.mjs creative build");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
