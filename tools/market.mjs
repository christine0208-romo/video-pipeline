#!/usr/bin/env node
/**
 * 资源市场目录（只读 provider + 复用 assets add 导入）：
 *   node tools/market.mjs search <关键词> [--provider id] [--limit N] [--json]
 *   node tools/market.mjs import <id> [--provider id] [--force]
 *   node tools/market.mjs browse [--provider id] [--category sans-serif] [--q text] [--offset N] [--limit N] [--json]
 *   node tools/market.mjs providers list [--json]
 *   node tools/market.mjs providers add <id> --type iconify|google-fonts --base-url URL [--label X] [--catalog-url URL] [--subset latin]
 *   node tools/market.mjs providers set <id> [--label X] [--base-url URL] [--catalog-url URL] [--subset S] [--enabled true|false] [--cache-hours N]
 *   node tools/market.mjs providers remove <id>
 *
 * id：图标 `prefix:name`，字体 `family-id:weight[-italic]`。
 * 导入仍走 node tools/assets.mjs add <url> ...，许可与来源写入素材清单。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../modules/lib/config.mjs";
import {
  addProvider,
  marketBrowse,
  marketImportArgs,
  marketProviderList,
  marketResolve,
  marketSearch,
  removeProvider,
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
    const result = await marketSearch(cfg, query, {
      limit: value("limit", undefined),
      providerId: providerOption(),
    });
    if (flag("json")) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(`[market] ${result.provider} · ${result.entries.length} / ${result.total} 条`);
    for (const entry of result.entries) {
      console.log(`${entry.id}\t${entry.license}\t${entry.source}\t${entry.url ?? entry.preview ?? "-"}`);
    }
    return 0;
  } catch (error) {
    console.error(`[market] 搜索失败：${error.message}`);
    return 1;
  }
}

async function importEntry() {
  const id = argv[1] && !argv[1].startsWith("-") ? argv[1] : null;
  if (!id) {
    console.log(
      "用法：node tools/market.mjs import <prefix:name|family-id:weight> [--provider id] [--force]",
    );
    return 1;
  }
  try {
    const entry = await marketResolve(cfg, id, {
      providerId: providerOption(),
    });
    const args = [
      path.join(cfg.paths.repo, "tools", "assets.mjs"),
      ...marketImportArgs(entry, { force: flag("force") }),
    ];
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

async function browse() {
  try {
    const result = await marketBrowse(cfg, {
      providerId: providerOption(),
      category: value("category", ""),
      query: value("q", ""),
      offset: Number(value("offset", 0)),
      limit: value("limit", undefined),
    });
    if (flag("json")) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    const unit = result.entries[0]?.kind === "collection" ? "个图标集" : "个字族";
    console.log(
      `[market] ${result.provider} · ${result.category || "全部"} · ${result.entries.length} / ${result.total} ${unit}`,
    );
    console.log(
      `类别：${result.categories.map((item) => `${item.id}(${item.count})`).join("  ")}`,
    );
    for (const entry of result.entries) {
      console.log(
        `${entry.id}\t${entry.name ?? entry.family}\t${entry.total ?? ""}\t${entry.license}`,
      );
    }
    return 0;
  } catch (error) {
    console.error(`[market] 浏览失败：${error.message}`);
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
          `${provider.id}\t${provider.type}\t${provider.label}\t${provider.enabled === false ? "停用" : "启用"}\t${provider.baseUrl}\t${provider.catalogUrl ?? ""}`,
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
        catalogUrl: value("catalog-url", undefined),
        subset: value("subset", undefined),
        cacheHours: value("cache-hours", undefined),
        enabled: flag("disabled") ? false : true,
        searchPlaceholder: value("search-placeholder", undefined),
      });
      console.log(`[market] 已添加 ${id}：${provider.label}`);
      return 0;
    }
    if (sub === "set") {
      if (!id) throw new Error("缺少市场源 id");
      const patch = {};
      for (const key of [
        "label",
        "kind",
        "base-url",
        "catalog-url",
        "subset",
        "search-placeholder",
      ]) {
        const next = value(key);
        if (next !== null) {
          patch[key === "base-url" ? "baseUrl" : key === "search-placeholder" ? "searchPlaceholder" : key === "catalog-url" ? "catalogUrl" : key] = next;
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
      ? await importEntry()
      : command === "browse"
        ? await browse()
        : command === "providers"
            ? providers()
            : (console.log(
                "用法：node tools/market.mjs search|browse|import|providers ...",
            ),
            1);
process.exit(code);
