#!/usr/bin/env node
/**
 * 一键入口：
 *   node run.mjs all
 *   node run.mjs scan --check
 *   node run.mjs creative plan --creative <id>
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
  creative: "modules/creative/index.mjs",
  mix: "modules/mix/index.mjs",
  fission: "modules/fission/index.mjs",
  quality: "modules/quality/index.mjs",
};

const TOOLS = {
  cache: "tools/cache.mjs",
  public: "tools/migrate-public.mjs",
  reindex: "tools/reindex.mjs",
  runtime: "tools/reconcile-runtime.mjs",
  sync: "tools/sync.mjs",
  projects: "tools/projects.mjs",
  shared: "tools/shared.mjs",
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
  // 进度信息走 stderr，保证 --json 的 stdout 只有数据。
  console.error(`\n▶ ${name}`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.error(`✓ ${name} ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

function help() {
  console.log(`用法：node run.mjs <stage> [参数]

stage:
  scan       扫描实拍素材，增量更新素材库
  creative   创意工程：scan / validate / plan / build / preview / review / reset
  quality    分析生成素材：pHash / 观感相似度 / 覆盖矩阵
  mix        规划并渲染混剪成片
  fission    按作品生成独立素材并出片
  all        scan -> creative build -> mix
  stills     只出混剪关键帧，供复查
  check      校验已有 EDL 的去重约束
  cache      列出/清理受管缓存与临时产物
  public     报告或迁移 public 链接投影
  reindex    按实际生成文件重建 catalog（默认 dry-run）
  runtime    隔离/清理检查、下载、public 备份残留
  sync       扫描创意包与素材清单：报告 / --apply 登记 / --check 只检查
  projects   扫描 projects/*/project.json，校验项目包
  shared     公共资源层：init 生成结构 / status 报告 / validate 校验

常用参数:
  --config <file>          配置文件，默认 config/pipeline.json
  --roots a,b              覆盖素材根目录
  --asset-roots a,b        覆盖素材库根目录（默认取 assets.roots）
  --limit N                只处理 N 个新素材（调试用）
  --check                  扫描后若有新/变更素材则退出码 2
  --duration N             成片时长（秒）
  --shot-length N          目标镜头长度（秒）；实际范围约 0.8N–1.25N
  --shot-min N             镜头长度下限（秒）
  --shot-max N             镜头长度上限（秒）
  --beat-jitter N          每作品节拍抖动比例（默认 0.15）
  --min-shots N            成片最少镜头数（默认 4）
  --max-shots N            成片最多镜头数（默认 12）
  --outputs N              成片条数
  --seed N                 随机种子
  --force                  全量重做
  --dry-run                只规划不渲染
  --stills-only            只出静帧
  --check-only             只校验 EDL
  --allow-draft            混剪时允许使用 draft 资产
  --allow-low-quality      混剪时允许使用质量检查不达标的生成素材
  --no-perceptual-dedupe   关闭同一条成片内的观感相近去重
  --report-only            quality 只读已存质量数据，不重新分析
  --layer s,o,t            quality 只分析指定层
  --scope shared|work      quality 只分析指定范围
  --edl <id>               检查某条成片引用的素材是否有近似重复/质量问题
  --strict                 有近似重复或质量失败时退出码 1
  --cluster-distance N     感知聚类 Hamming 阈值（默认 12）
  --similarity-threshold N 近似重复 score 阈值（默认 0.86）
  --music <auto|id|path>   指定 BGM；auto 自动选曲
  --no-music               关闭 BGM
  --music-mood <mood>      自动选曲情绪：calm / cinematic / uplifting / energetic
  --music-energy <level>   自动选曲能量：low / medium / high
  --music-volume N         音乐音量 0–1
  --no-sfx                 关闭 SFX
  --sfx                    开启 SFX
  --bpm N                  指定 BPM；为空时用选中曲目的 BPM
  --work <id>              混剪只使用 shared + 指定 work 的素材
  --works N                fission 生成几个作品
  --with-assets            fission 时为每个作品生成专属素材（默认只用 shared）
  --no-assets              强制使用 shared 素材库
  --require-work-asset     mix --work 时必须使用至少一条 work 素材
  --work-seed N            fission 指定 work seed（默认由 work id 派生）
  --per-layer s,o,t        fission 每类生成数量：scene,overlay,transition
  --scene/--overlay/--transition N 单独覆盖对应层数量
  --share id1,id2|all-work:<id>   把 work 素材提升为 shared
  --list-works             列出 work 素材与产出
  --clean-work <id>        清理 work 素材（默认 dry-run，加 --force 删除）
`);
}

ensureDeps();

if (TOOLS[stage]) {
  const script = path.join(ROOT, TOOLS[stage]);
  const result = spawnSync(process.execPath, [script, ...rest], {
    cwd: REPO,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

if (stage === "all") {
  for (const name of ["scan", "creative", "mix"]) runStage(name, rest);
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
