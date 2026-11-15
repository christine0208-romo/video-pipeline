#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../lib/config.mjs";
import { readJson, writeJson } from "../lib/fsx.mjs";
import { writeCatalog } from "../generate/catalog.mjs";
import { buildCreatives, planCreatives, previewCreatives } from "./build.mjs";
import { validateAll } from "./loader.mjs";
import { registryStatus, writeRegistry } from "./registry.mjs";
import { reviewCatalog } from "./review.mjs";

const HELP = `用法：node run.mjs creative <子命令> [参数]

子命令：
  scan [--json] [--write-registry|--check-registry]
                           列出创意工程、变体与校验结果；生成/校验引擎注册表
  validate [--strict]      校验 creative/ 数据；--strict 把警告也视为失败
  plan [--creative id] [--variant id] [--item id|序号] [--json]
                           只编译并打印将生成的素材，不写文件
  build [--creative id] [--variant id] [--item id|序号] [--force] [--dry-run] [--prune]
                           编译、渲染、质量分析并写回 catalog
  preview --creative id [--variant id] [--item id|序号] [--frame N]
                           只渲染静帧到 out/creatives/，不改 catalog
  review [--creative id] [--variant id] [--id assetId] --status approved|retired
                           修改创意图材的审核状态
  share <workId|all-work:id|ids>   把 work 素材提升为 shared
  clean-work <workId> [--force]    清理 work 素材（默认 dry-run）
  list-works               列出 work 素材与产出
  reset [--apply] [--force] 清空生成产物（catalog 生成条目、props、out/assets、静帧、质量报告、EDL）
`;

function printValidation(result) {
  console.log(
    `[creative] 引擎 ${result.engines.size} 个 / 工程 ${result.projects.length} 个 / 错误 ${result.errors.length} / 警告 ${result.warnings.length}`,
  );
  for (const project of result.projects) {
    const items = project.variants.reduce(
      (sum, variant) => sum + (variant.items?.length ?? 0),
      0,
    );
    console.log(
      `  ${project.id}\tv${project.version}\t${project.engine}\t${project.variants.length} 个变体 / ${items} 条素材\t${project.status ?? "active"}`,
    );
  }
  for (const error of result.errors) console.error(`  ✗ ${error}`);
  for (const warning of result.warnings) console.warn(`  ! ${warning}`);
}

function commandScan(cfg, { json = false, writeRegistry: write = false, checkRegistry = false } = {}) {
  const result = validateAll(cfg);
  let registry = null;
  if (!result.errors.length) {
    if (write) {
      const file = writeRegistry(cfg);
      console.log(`[creative] 注册表 -> ${file}`);
      registry = { ok: true, written: true };
    } else if (checkRegistry) {
      registry = registryStatus(cfg);
      if (!registry.ok) console.error(`[creative] ${registry.reason}`);
    }
  }
  if (json) {
    console.log(
      JSON.stringify(
        {
          engines: [...result.engines.keys()],
          projects: result.projects.map((project) => ({
            id: project.id,
            version: project.version,
            engine: project.engine,
            status: project.status ?? "active",
            variants: project.variants.map((variant) => ({
              id: variant.id,
              style: variant.style,
              version: variant.version ?? 1,
              items: variant.items?.length ?? 0,
            })),
          })),
          errors: result.errors,
          warnings: result.warnings,
          registry,
        },
        null,
        2,
      ),
    );
  } else {
    printValidation(result);
    if (registry && !registry.written) {
      console.log(
        registry.ok ? "[creative] 注册表已是最新" : `[creative] ${registry.reason}`,
      );
    }
  }
  if (result.errors.length) return 1;
  if (checkRegistry && registry && !registry.ok) return 1;
  return 0;
}

function commandValidate(cfg, { strict = false } = {}) {
  const result = validateAll(cfg);
  printValidation(result);
  if (result.errors.length) {
    console.error("[creative] 校验失败");
    return 1;
  }
  if (strict && result.warnings.length) {
    console.error("[creative] 存在警告，--strict 视为失败");
    return 1;
  }
  console.log("[creative] 校验通过");
  return 0;
}

function commandPlan(cfg, { creativeId, variantId, item, json = false }) {
  const entries = planCreatives(cfg, { creativeId, variantId, item });
  if (json) {
    console.log(
      JSON.stringify(
        entries.map((entry) => ({
          id: entry.id,
          creativeId: entry.creativeId,
          variantId: entry.variantId,
          style: entry.style,
          preset: entry.preset,
          duration: entry.duration,
          durationInFrames: entry.durationInFrames,
          alpha: entry.alpha,
          status: entry.status,
          paramsHash: entry.paramsHash,
          props: entry.props,
        })),
        null,
        2,
      ),
    );
    return 0;
  }
  console.log("id\tcreative/variant\tstyle\tduration\talpha\tparams");
  for (const entry of entries) {
    console.log(
      `${entry.id}\t${entry.creativeId}/${entry.variantId}\t${entry.style}\t${entry.duration}s\t${entry.alpha ? "yes" : "no"}\t${JSON.stringify(entry.props)}`,
    );
  }
  console.log(`[creative] 共 ${entries.length} 条候选`);
  return 0;
}

function commandBuild(cfg, options) {
  const result = buildCreatives(cfg, options);
  return result.failed ? 1 : 0;
}

function commandPreview(cfg, { creativeId, variantId, item, frame }) {
  if (!creativeId) throw new Error("preview 需要 --creative");
  const files = previewCreatives(cfg, { creativeId, variantId, item, frame });
  for (const file of files) console.log(`[creative] 预览 ${file}`);
  return 0;
}

function commandReview(cfg, { creativeId, variantId, assetId, status }) {
  if (!["approved", "retired"].includes(status)) {
    throw new Error("--status 只能是 approved / retired");
  }
  const catalog = readJson(path.join(cfg.paths.data, "catalog.json"), null);
  if (!catalog?.assets?.length) throw new Error("catalog 为空");
  const targets = catalog.assets.filter(
    (asset) =>
      asset.creativeId &&
      (!creativeId || asset.creativeId === creativeId) &&
      (!variantId || asset.variantId === variantId) &&
      (assetId ? asset.id === assetId : asset.status !== "retired"),
  );
  const timestamp = new Date().toISOString();
  for (const asset of targets) {
    asset.status = status;
    if (status === "approved") {
      asset.approvedAt = timestamp;
      delete asset.rejectedAt;
    } else {
      asset.rejectedAt = timestamp;
    }
  }
  writeCatalog(cfg, catalog.assets);
  console.log(`[creative] ${status} ${targets.length} 条`);
  return 0;
}

function commandReset(cfg, { apply = false, force = false }) {
  const edlDir = path.join(cfg.paths.data, "edl");
  const edls = existsSync(edlDir)
    ? readdirSync(edlDir).filter(
        (name) =>
          name.endsWith(".json") &&
          !name.endsWith(".props.json") &&
          name !== "signatures.json",
      )
    : [];
  if (edls.length) {
    if (apply && !force) {
      throw new Error(
        `仍有 ${edls.length} 条 EDL 引用生成素材；确认后可加 --force：${edls.join(", ")}`,
      );
    }
    console.log(
      `[creative] ${edls.length} 条 EDL${apply ? " 将随 reset 删除" : " 会在 --apply 时删除"}`,
    );
  }

  const targets = [
    path.join(cfg.paths.data, "props"),
    path.join(cfg.paths.out, "assets"),
    path.join(cfg.paths.out, "stills", "assets"),
    path.join(cfg.paths.out, "creatives"),
    path.join(cfg.paths.data, "quality", "report.json"),
    path.join(cfg.paths.out, "quality", "report.md"),
    path.join(cfg.paths.data, "creative", "build-state.json"),
    path.join(cfg.paths.data, "edl"),
    path.join(cfg.paths.data, "works"),
  ];
  const catalog = readJson(path.join(cfg.paths.data, "catalog.json"), {
    version: 1,
    assets: [],
  });
  const assets = catalog.assets ?? [];
  console.log(`[creative] reset：${assets.length} 条 catalog 生成条目，${targets.length} 个目录/报告`);
  if (!apply) {
    console.log("[creative] dry-run：加 --apply 才删除");
    return 0;
  }
  for (const target of targets) {
    rmSync(target, { recursive: true, force: true });
  }
  writeJson(path.join(cfg.paths.data, "catalog.json"), {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets: [],
  });
  console.log("[creative] 已清空生成产物");
  return 0;
}

try {
  const cfg = loadConfig(process.argv.slice(2));
  const [command = "scan"] = cfg.positionals ?? [];
  const options = {
    creativeId: cfg.flags.creative ?? null,
    variantId: cfg.flags.variant ?? null,
    item: cfg.flags.item ?? null,
    force: Boolean(cfg.flags.force),
    dryRun: Boolean(cfg.flags["dry-run"]),
    prune: Boolean(cfg.flags.prune),
    json: Boolean(cfg.flags.json),
    strict: Boolean(cfg.flags.strict),
    writeRegistry: Boolean(cfg.flags["write-registry"]),
    checkRegistry: Boolean(cfg.flags["check-registry"]),
    frame: cfg.flags.frame !== undefined ? Number(cfg.flags.frame) : null,
    assetId: cfg.flags.id ?? null,
    status: cfg.flags.status ?? null,
    apply: Boolean(cfg.flags.apply),
  };

  let code = 0;
  if (command === "scan") code = commandScan(cfg, options);
  else if (command === "validate") code = commandValidate(cfg, options);
  else if (command === "plan") code = commandPlan(cfg, options);
  else if (command === "build") code = commandBuild(cfg, options);
  else if (command === "preview") code = commandPreview(cfg, options);
  else if (command === "review") code = commandReview(cfg, options);
  else if (command === "share") {
    cfg.flags.share = cfg.positionals[1] ?? cfg.flags.share;
    if (!cfg.flags.share) throw new Error("share 需要 work id 或素材 id");
    code = reviewCatalog(cfg);
  } else if (command === "clean-work") {
    cfg.flags["clean-work"] = cfg.positionals[1] ?? cfg.flags["clean-work"];
    if (!cfg.flags["clean-work"]) throw new Error("clean-work 需要 work id");
    code = reviewCatalog(cfg);
  } else if (command === "list-works") {
    cfg.flags["list-works"] = true;
    code = reviewCatalog(cfg);
  } else if (command === "reset") code = commandReset(cfg, options);
  else if (command === "help" || command === "--help") {
    console.log(HELP);
  } else {
    console.error(`未知子命令：${command}`);
    console.log(HELP);
    code = 1;
  }
  process.exit(code);
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
