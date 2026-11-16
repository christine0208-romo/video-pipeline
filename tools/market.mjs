#!/usr/bin/env node
/**
 * 资源市场目录（只读 provider + 复用 assets add 导入）：
 *   node tools/market.mjs search <关键词> [--provider id] [--limit N] [--json]
 *   node tools/market.mjs import <prefix:name> [--provider id] [--force]
 *   node tools/market.mjs featured [--provider id] [--json]
 *   node tools/market.mjs providers list [--json]
 *   node tools/market.mjs providers add <id> [--type iconify] [--label X] [--base-url URL] [--featured a,b]
 *   node tools/market.mjs providers set <id> [--label X] [--base-url URL] [--enabled true|false] [--cache-hours N] [--featured a,b]
 *   node tools/market.mjs providers remove <id>
 *
 * 导入仍走 node tools/assets.mjs add <url> ...，许可与来源写入素材清单。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import {
  addProvider,
  featuredIconify,
  marketProviderList,
  removeProvider,
  resolveIconifyIcon,
  searchIconify,
  setProvider,
} from "../modules/lib/market.mjs";

const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith("-") ? argv[0] : "search";
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};
const cfg = loadConfig(argv);

function providerOption() {
  return value("provider");
}

async function search() {
  const query = argv[1] && !argv[1].startsWith("-") ? argv[1] : value("query");
  if (!query) {
    console.log("用法：node tools/market.mjs search <关键词> [--provider id] [--limit N] [--json]");
    return 1;
  }
  try {
    const result = await searchIconify(cfg, query, {
      limit: value("limit", undefined),
      providerId: providerOption(),
    });
    if (flag("json")) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(`[market] ${result.provider} · ${result.entries.length} / ${result.total} 条`);
    for (const entry of result.entries) {
      console.log(`${entry.id}\t${entry.license}\t${entry.source}\t${entry.url}`);
    }
    return 0;
  } catch (error) {
    console.error(`[market] 搜索失败：${error.message}`);
    return 1;
  }
}

async function importIcon() {
  const icon = argv[1] && !argv[1].startsWith("-") ? argv[1] : null;
  if (!icon) {
    console.log("用法：node tools/market.mjs import <prefix:name> [--provider id] [--force]");
    return 1;
  }
  try {
    const entry = await resolveIconifyIcon(cfg, icon, {
      providerId: providerOption(),
    });
    const args = [
      path.join(cfg.paths.repo, "tools", "assets.mjs"),
      "add",
      entry.url,
      "--kind",
      "icons",
      "--name",
      entry.fileName,
      "--license",
      entry.license,
      "--source",
      entry.source,
    ];
    if (flag("force")) args.push("--force");
    console.log(`[market] 导入 ${entry.id} ← ${entry.url}`);
    console.log(`[market] 许可 ${entry.license} · 来源 ${entry.source}`);
    const result = spawnSync(process.execPath, args, {
      cwd: cfg.paths.repo,
      stdio: "inherit",
    });
    return result.status ?? 1;
  } catch (error) {
    console.error(`[market] 导入失败：${error.message}`);
    return 1;
  }
}

async function featured() {
  try {
    const result = await featuredIconify(cfg, { providerId: providerOption() });
    if (flag("json")) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    for (const collection of result.collections) {
      console.log(
        `${collection.prefix}\t${collection.name}\t${collection.license}\t${collection.total} 个图标`,
      );
      console.log(`  ${collection.samples.map((item) => item.id).join(", ")}`);
    }
    return 0;
  } catch (error) {
    console.error(`[market] 推荐失败：${error.message}`);
    return 1;
  }
}

function providers() {
  const sub = argv[1] ?? "list";
  const id = argv[2] && !argv[2].startsWith("-") ? argv[2] : null;
  try {
    if (sub === "list") {
      const list = marketProviderList(cfg);
      if (flag("json")) {
        console.log(JSON.stringify(list, null, 2));
        return 0;
      }
      for (const provider of list) {
        console.log(
          `${provider.id}\t${provider.type}\t${provider.label}\t${provider.enabled === false ? "停用" : "启用"}\t${provider.baseUrl}\t${provider.featured?.join(",") ?? ""}`,
        );
      }
      return 0;
    }
    if (sub === "add") {
      if (!id) throw new Error("缺少市场源 id");
      const provider = addProvider(cfg, {
        id,
        type: value("type", undefined),
        label: value("label", id),
        kind: value("kind", undefined),
        baseUrl: value("base-url", undefined),
        cacheHours: value("cache-hours", undefined),
        enabled: flag("disabled") ? false : true,
        searchPlaceholder: value("search-placeholder", undefined),
        suggestions: value("suggestions", undefined),
        featured: value("featured", undefined),
      });
      console.log(`[market] 已添加 ${id}：${provider.label}`);
      return 0;
    }
    if (sub === "set") {
      if (!id) throw new Error("缺少市场源 id");
      const patch = {};
      for (const key of ["label", "kind", "base-url", "featured", "suggestions", "search-placeholder"]) {
        const next = value(key);
        if (next !== null) {
          patch[key === "base-url" ? "baseUrl" : key === "search-placeholder" ? "searchPlaceholder" : key] = next;
        }
      }
      const cacheHours = value("cache-hours");
      if (cacheHours !== null) patch.cacheHours = Number(cacheHours);
      const enabled = value("enabled");
      if (enabled !== null) patch.enabled = enabled !== "false";
      if (!Object.keys(patch).length) throw new Error("没有要修改的字段");
      const provider = setProvider(cfg, id, patch);
      console.log(`[market] 已更新 ${id}：${provider.label}`);
      return 0;
    }
    if (sub === "remove") {
      if (!id) throw new Error("缺少市场源 id");
      removeProvider(cfg, id);
      console.log(`[market] 已移除 ${id}`);
      return 0;
    }
    console.log(
      "用法：node tools/market.mjs providers list|add|set|remove ...",
    );
    return 1;
  } catch (error) {
    console.error(`[market] ${error.message}`);
    return 1;
  }
}

const code =
  command === "search"
    ? await search()
    : command === "import"
      ? await importIcon()
      : command === "featured"
        ? await featured()
        : command === "providers"
          ? providers()
          : (console.log(
              "用法：node tools/market.mjs search|import|featured|providers ...",
            ),
            1);
process.exit(code);
