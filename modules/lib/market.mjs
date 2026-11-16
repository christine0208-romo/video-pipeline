import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FALLBACK = {
  version: 1,
  defaults: {},
  providers: {},
};

const PROVIDER_ID = /^[a-z0-9-]+$/;
const PREFIX = /^[a-z0-9-]+$/;
const ICON_ID = /^[a-z0-9-]+:[a-z0-9-]+$/;

function readLocal(cfg) {
  const file = path.join(cfg.paths.repo, "config", "local.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) ?? {};
  } catch {
    return {};
  }
}

export function loadMarketConfig(cfg) {
  const local = readLocal(cfg);
  return {
    version: 1,
    defaults: {
      ...(cfg.market?.defaults ?? FALLBACK.defaults),
      ...(local.market?.defaults ?? {}),
    },
    providers: {
      ...(cfg.market?.providers ?? {}),
      ...(local.market?.providers ?? {}),
    },
  };
}

export function marketProviders(cfg) {
  return loadMarketConfig(cfg).providers ?? {};
}

export function marketDefaults(cfg) {
  return loadMarketConfig(cfg).defaults ?? {};
}

export function getProvider(cfg, providerId = null) {
  const providers = marketProviders(cfg);
  if (providerId) {
    const provider = providers[providerId];
    if (!provider) throw new Error(`未知市场源：${providerId}`);
    return { id: providerId, ...provider };
  }
  const found = Object.entries(providers).find(
    ([, provider]) => provider.enabled !== false,
  );
  if (!found) throw new Error("没有启用的市场源");
  return { id: found[0], ...found[1] };
}

export function marketProviderList(cfg) {
  return Object.entries(marketProviders(cfg)).map(([id, provider]) => ({
    id,
    ...provider,
  }));
}

function normalizeBaseUrl(value) {
  const text = String(value ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(text)) {
    throw new Error("baseUrl 必须是 http(s) 地址");
  }
  return text;
}

function normalizeFeatured(value) {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : String(value).split(",");
  const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
  for (const prefix of cleaned) {
    if (!PREFIX.test(prefix)) throw new Error(`featured 里的图标集不合法：${prefix}`);
  }
  return [...new Set(cleaned)];
}

function normalizeSuggestions(value) {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

export function addProvider(cfg, input) {
  const id = String(input.id ?? "").trim();
  if (!PROVIDER_ID.test(id)) throw new Error("市场源 id 只能包含小写字母、数字、连字符");
  const config = loadMarketConfig(cfg);
  const defaults = config.defaults ?? {};
  config.providers ??= {};
  if (config.providers[id]) throw new Error(`市场源已存在：${id}`);
  const type = String(input.type ?? defaults.type ?? "");
  if (!type) throw new Error("缺少 provider type");
  if (type !== "iconify") throw new Error("目前只支持 type=iconify");
  const baseUrl = input.baseUrl ?? defaults.baseUrl;
  if (!baseUrl) throw new Error("缺少 baseUrl");
  const cacheHours = Number(input.cacheHours ?? defaults.cacheHours);
  if (!Number.isFinite(cacheHours) || cacheHours < 1) {
    throw new Error("缺少 cacheHours");
  }
  config.providers[id] = {
    type,
    label: String(input.label ?? id),
    kind: String(input.kind ?? defaults.kind ?? ""),
    baseUrl: normalizeBaseUrl(baseUrl),
    cacheHours,
    enabled: input.enabled !== false && input.enabled !== "false",
    searchPlaceholder: String(input.searchPlaceholder ?? defaults.searchPlaceholder ?? ""),
    suggestions: normalizeSuggestions(input.suggestions) ?? [],
    featured: normalizeFeatured(input.featured ?? []),
  };
  writeMarketConfig(cfg, config);
  return config.providers[id];
}

export function setProvider(cfg, id, patch) {
  const config = loadMarketConfig(cfg);
  const provider = config.providers?.[id];
  if (!provider) throw new Error(`未知市场源：${id}`);
  if (patch.label !== undefined) provider.label = String(patch.label);
  if (patch.kind !== undefined) provider.kind = String(patch.kind);
  if (patch.baseUrl !== undefined) provider.baseUrl = normalizeBaseUrl(patch.baseUrl);
  if (patch.cacheHours !== undefined) {
    provider.cacheHours = Math.max(1, Number(patch.cacheHours));
  }
  if (patch.enabled !== undefined) {
    provider.enabled = patch.enabled !== false && patch.enabled !== "false";
  }
  if (patch.featured !== undefined) {
    provider.featured = normalizeFeatured(patch.featured);
  }
  if (patch.suggestions !== undefined) {
    provider.suggestions = normalizeSuggestions(patch.suggestions);
  }
  if (patch.searchPlaceholder !== undefined) {
    provider.searchPlaceholder = String(patch.searchPlaceholder);
  }
  writeMarketConfig(cfg, config);
  return provider;
}

export function removeProvider(cfg, id) {
  const config = loadMarketConfig(cfg);
  if (!config.providers?.[id]) throw new Error(`未知市场源：${id}`);
  delete config.providers[id];
  writeMarketConfig(cfg, config);
  return true;
}

function writeMarketConfig(cfg, config) {
  const file = path.join(cfg.paths.repo, "config", "local.json");
  const local = readLocal(cfg);
  local.market = {
    ...(local.market ?? {}),
    providers: config.providers ?? {},
  };
  writeFileSync(file, `${JSON.stringify(local, null, 2)}\n`);
}

function collectionsCacheFile(cfg, providerId) {
  return path.join(cfg.paths.data, "market", `${providerId}.collections.json`);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "video-pipeline-market/1" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`市场源请求失败：HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadCollections(cfg, providerId = null, { force = false } = {}) {
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const file = collectionsCacheFile(cfg, provider.id);
  const maxAge = Number(provider.cacheHours ?? 24) * 3600 * 1000;
  if (!force && existsSync(file)) {
    try {
      const cached = JSON.parse(readFileSync(file, "utf8"));
      if (cached?.fetchedAt && Date.now() - cached.fetchedAt < maxAge) {
        return cached.collections ?? {};
      }
    } catch {
      /* refresh below */
    }
  }
  const collections = await fetchJson(`${provider.baseUrl}/collections`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ fetchedAt: Date.now(), collections }, null, 2)}\n`,
  );
  return collections;
}

function entryOf(provider, icon, collections) {
  const [prefix, name] = icon.split(":");
  const meta = collections[prefix] ?? {};
  return {
    id: icon,
    provider: provider.id,
    kind: provider.kind ?? "icon",
    name,
    prefix,
    collection: meta.name ?? prefix,
    license: meta.license?.spdx ?? meta.license?.title ?? "unknown",
    licenseUrl: meta.license?.url ?? null,
    source: `Iconify / ${meta.name ?? prefix}`,
    author: meta.author?.name ?? null,
    url: `${provider.baseUrl}/${prefix}/${name}.svg`,
    preview: `${provider.baseUrl}/${prefix}/${name}.svg`,
    fileName: `${prefix}-${name}.svg`,
  };
}

export async function searchIconify(cfg, query, { limit = 24, providerId = null } = {}) {
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  if (provider.enabled === false) throw new Error(`市场源已停用：${provider.id}`);
  const text = String(query ?? "").trim();
  if (!text) throw new Error("缺少搜索关键词");
  const defaults = marketDefaults(cfg);
  const fallbackLimit = provider.searchLimit ?? defaults.searchLimit;
  const count = Math.max(1, Math.min(60, Number(limit ?? fallbackLimit)));
  if (!Number.isFinite(count)) throw new Error("缺少搜索条数");
  const data = await fetchJson(
    `${provider.baseUrl}/search?query=${encodeURIComponent(text)}&limit=${count}`,
  );
  const collections = await loadCollections(cfg, provider.id);
  const entries = (data.icons ?? [])
    .slice(0, count)
    .map((icon) => entryOf(provider, icon, collections));
  return {
    provider: provider.id,
    query: text,
    total: data.total ?? entries.length,
    entries,
  };
}

export async function resolveIconifyIcon(cfg, icon, { providerId = null } = {}) {
  if (!ICON_ID.test(String(icon ?? ""))) {
    throw new Error("图标 id 格式应为 prefix:name");
  }
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const collections = await loadCollections(cfg, provider.id);
  const [prefix] = String(icon).split(":");
  if (!collections[prefix]) throw new Error(`未知图标集：${prefix}`);
  return entryOf(provider, String(icon), collections);
}

export async function collectionIconify(
  cfg,
  { providerId = null, prefix, query = "", offset = 0, limit = 120 } = {},
) {
  if (!PREFIX.test(String(prefix ?? ""))) throw new Error("图标集前缀不合法");
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const collections = await loadCollections(cfg, provider.id);
  const meta = collections[prefix];
  if (!meta) throw new Error(`未知图标集：${prefix}`);
  const data = await fetchJson(
    `${provider.baseUrl}/collection?prefix=${encodeURIComponent(prefix)}`,
  );
  const names = [
    ...(data.uncategorized ?? []),
    ...Object.values(data.categories ?? {}).flat(),
  ];
  const text = String(query ?? "").trim().toLowerCase();
  const filtered = text
    ? names.filter((name) => String(name).toLowerCase().includes(text))
    : names;
  const start = Math.max(0, Number(offset) || 0);
  const defaults = marketDefaults(cfg);
  const fallbackLimit = provider.collectionLimit ?? defaults.collectionLimit;
  const count = Math.max(1, Math.min(240, Number(limit ?? fallbackLimit)));
  if (!Number.isFinite(count)) throw new Error("缺少集合分页条数");
  return {
    provider: provider.id,
    prefix,
    name: meta.name ?? prefix,
    license: meta.license?.spdx ?? meta.license?.title ?? "unknown",
    total: filtered.length,
    offset: start,
    limit: count,
    entries: filtered
      .slice(start, start + count)
      .map((name) => entryOf(provider, `${prefix}:${name}`, collections)),
  };
}

export async function featuredIconify(cfg, { providerId = null } = {}) {  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const collections = await loadCollections(cfg, provider.id);
  const prefixes = provider.featured ?? [];
  return {
    provider: provider.id,
    collections: prefixes
      .map((prefix) => {
        const meta = collections[prefix] ?? {};
        const samples = (meta.samples ?? []).map((name) =>
          entryOf(provider, `${prefix}:${name}`, collections),
        );
        return {
          prefix,
          name: meta.name ?? prefix,
          license: meta.license?.spdx ?? meta.license?.title ?? "unknown",
          total: meta.total ?? 0,
          samples,
        };
      })
      .filter((item) => item.samples.length),
  };
}
