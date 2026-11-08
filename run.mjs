#!/usr/bin/env node
/**
 * 一键入口：
 *   node run.mjs all
 *   node run.mjs scan --check
 *   node run.mjs generate --only platform-orbit --variants 1
 *   node run.mjs mix --duration 15 --outputs 2
 *   node run.mjs stills
 *   node run.mjs check
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = ROOT;

const STAGES = {
  scan: "modules/scan/index.mjs",
  generate: "modules/generate/index.mjs",
  mix: "modules/mix/index.mjs",
};

const argv = process.argv.slice(2);
const first = argv[0];
const hasStage = first && !first.startsWith("--");
const stage = hasStage ? first : "all";
const rest = hasStage ? argv.slice(1) : argv;

function ensureDeps() {
  if (!existsSync(path.join(REPO, "node_modules", "@remotion", "cli"))) {
    console.error("缺少依赖：先在仓库根目录执行 npm install");
    process.exit(1);
  }
}

function runStage(name, args) {
  const script = path.join(ROOT, STAGES[name]);
  console.log(`\n▶ ${name}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`✓ ${name} ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

function help() {
  console.log(`用法：node run.mjs <stage> [参数]

stage:
  scan       扫描实拍素材，增量更新素材库
  generate   渲染生成素材库（MP4 + 透明 WebM）
  mix        规划并渲染混剪成片
  all        scan -> generate -> mix
  stills     只出混剪关键帧，供复查
  check      校验已有 EDL 的去重约束

常用参数:
  --config <file>          配置文件，默认 config/pipeline.json
  --roots a,b              覆盖素材根目录
  --limit N                只处理 N 个新素材（调试用）
  --check                  扫描后若有新/变更素材则退出码 2
  --only p1,p2             只生成指定 preset
  --variants N             每个 preset 生成几组变体
  --generate-duration N    生成片段时长（秒）
  --duration N             成片时长（秒）
  --outputs N              成片条数
  --seed N                 随机种子
  --force                  全量重做
  --dry-run                只规划不渲染
  --stills-only            只出静帧
  --check-only             只校验 EDL
`);
}

ensureDeps();

if (stage === "all") {
  for (const name of ["scan", "generate", "mix"]) runStage(name, rest);
} else if (stage === "stills") {
  runStage("mix", [...rest, "--stills-only"]);
} else if (stage === "check") {
  runStage("mix", [...rest, "--check-only"]);
} else if (STAGES[stage]) {
  runStage(stage, rest);
} else {
  help();
  process.exit(stage === "help" || stage === "--help" ? 0 : 1);
}
