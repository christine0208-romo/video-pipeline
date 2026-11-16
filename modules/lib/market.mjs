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
const FONT_ID = /^([a-z0-9-]+):([1-9]00)(-italic)?$/;
const SUBSET = /^[a-z0-9-]+$/;
const TYPES = new Set(["iconify", "google-fonts"]);
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

/** 推荐来源模板：来自 config/local.example.json，工作台用它预填“添加来源”。 */
export function providerTemplates(cfg) {
  const file = path.join(cfg.paths.repo, "config", "local.example.json");
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const providers = parsed?.market?.providers ?? {};
    const templates = {};
    for (const [id, provider] of Object.entries(providers)) {
      if (!provider || typeof provider !== "object") continue;
      templates[id] = { id, ...provider };
    }
    return templates;
  } catch {
    return {};
  }
}

function normalizeBaseUrl(value) {
  const text = String(value ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(text)) {
    throw new Error("baseUrl 必须是 http(s) 地址");
  }
  return text;
}

export function addProvider(cfg, input) {
  const id = String(input.id ?? "").trim();
  if (!PROVIDER_ID.test(id)) throw new Error("市场源 id 只能包含小写字母、数字、连字符");
  const config = loadMarketConfig(cfg);
  const defaults = config.defaults ?? {};
  config.providers ??= {};
  if (config.providers[id]) throw new Error(`市场源已存在：${id}`);
  const type = String(input.type ?? defaults.type ?? "").trim();
  if (!type) throw new Error("缺少 provider type（iconify / google-fonts）");
  if (!TYPES.has(type)) {
    throw new Error(`不支持的 provider type：${type}（可用：${[...TYPES].join(" / ")}）`);
  }
  const baseUrl = input.baseUrl ?? defaults.baseUrl;
  if (!baseUrl) throw new Error("缺少 baseUrl");
  const catalogUrl = input.catalogUrl ? normalizeBaseUrl(input.catalogUrl) : null;
  if (type === "google-fonts" && !catalogUrl) {
    throw new Error("google-fonts 需要 catalogUrl（字体目录地址）");
  }
  const cacheHours = Number(input.cacheHours ?? defaults.cacheHours);
  if (!Number.isFinite(cacheHours) || cacheHours < 1) {
    throw new Error("缺少 cacheHours");
  }
  config.providers[id] = {
    type,
    label: String(input.label ?? id),
    kind: String(input.kind ?? (type === "google-fonts" ? "font" : "icon")),
    baseUrl: normalizeBaseUrl(baseUrl),
    cacheHours,
    enabled: input.enabled !== false && input.enabled !== "false",
    searchPlaceholder: String(input.searchPlaceholder ?? defaults.searchPlaceholder ?? ""),
    ...(catalogUrl ? { catalogUrl } : {}),
    ...(type === "google-fonts"
      ? { subset: String(input.subset ?? "latin") }
      : {}),
  };
  if (config.providers[id].subset && !SUBSET.test(config.providers[id].subset)) {
    throw new Error("subset 只能包含小写字母、数字、连字符");
  }
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
  if (patch.catalogUrl !== undefined) {
    provider.catalogUrl = normalizeBaseUrl(patch.catalogUrl);
  }
  if (patch.subset !== undefined) {
    const subset = String(patch.subset).trim();
    if (!SUBSET.test(subset)) throw new Error("subset 只能包含小写字母、数字、连字符");
    provider.subset = subset;
  }
  if (patch.enabled !== undefined) {
    provider.enabled = patch.enabled !== false && patch.enabled !== "false";
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

function marketCacheFile(cfg, ...parts) {
  return path.join(cfg.paths.data, "market", ...parts);
}

function readCache(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(file, payload) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

async function requestJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { "User-Agent": "video-pipeline-market/1", ...headers },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 304) return { notModified: true, headers: response.headers };
  if (!response.ok) throw new Error(`市场源请求失败：HTTP ${response.status}`);
  return { data: await response.json(), headers: response.headers };
}

function cacheValue(cached) {
  if (!cached) return null;
  return cached.data ?? cached.collections ?? cached.fonts ?? null;
}

/**
 * 缓存 JSON：未过期直接用；过期后带 If-None-Match / If-Modified-Since 做条件请求，
 * 304 只更新时间戳；失败沿用旧缓存（有旧缓存时不让市场整体不可用）。
 */
async function cachedJson(cfg, { file, url, maxAgeMs, label, force = false }) {
  const cached = readCache(file);
  const value = cacheValue(cached);
  const now = Date.now();
  if (!force && cached && typeof cached.fetchedAt === "number" && now - cached.fetchedAt < maxAgeMs) {
    return value;
  }
  const headers = {};
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  else if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
  try {
    const result = await requestJson(url, headers);
    if (result.notModified && cached) {
      writeCache(file, { ...cached, fetchedAt: now, checkedAt: now });
      return value;
    }
    const next = {
      version: 1,
      fetchedAt: now,
      checkedAt: now,
      lastModified: result.headers.get("last-modified") ?? cached?.lastModified ?? null,
      etag: result.headers.get("etag") ?? cached?.etag ?? null,
      data: result.data,
    };
    writeCache(file, next);
    return next.data;
  } catch (error) {
    if (cached) {
      console.warn(`[market] ${label} 更新失败，沿用缓存：${error.message}`);
      return value;
    }
    throw error;
  }
}

export async function loadCollections(cfg, providerId = null, { force = false } = {}) {
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const maxAgeMs = Number(provider.cacheHours ?? 24) * 3600 * 1000;
  const data = await cachedJson(cfg, {
    file: collectionsCacheFile(cfg, provider.id),
    url: `${provider.baseUrl}/collections`,
    maxAgeMs,
    label: `图标集清单（${provider.id}）`,
    force,
  });
  return data ?? {};
}

function collectionCacheFile(cfg, providerId, prefix) {
  return marketCacheFile(cfg, `${providerId}.collection.${prefix}.json`);
}

function entryOf(provider, icon, collections) {
  const [prefix, name] = icon.split(":");
  const meta = collections[prefix] ?? {};
  return {
    id: icon,
    provider: provider.id,
    kind: provider.kind ?? "icon",
    dir: "icons",
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
    providerRef: prefix,
  };
}

const ICON_NAME = /^[a-z0-9_-]+$/;
const ICON_CONCURRENCY = 2;
const ICON_MIN_INTERVAL = 125;
const ICON_BACKOFF = [1000, 3000, 8000, 15000];
const ICON_COOLDOWN = 15000;
const iconPending = [];
let iconActive = 0;
let iconNextAt = 0;
let iconCooldownUntil = 0;
let iconPumpTimer = null;

async function fetchIconOnce(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "video-pipeline-market/1" },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 429 || response.status >= 500) {
    const error = new Error(`HTTP ${response.status}`);
    error.retryable = true;
    error.status = response.status;
    throw error;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function scheduleIconPump(delay) {
  if (iconPumpTimer) return;
  iconPumpTimer = setTimeout(() => {
    iconPumpTimer = null;
    pumpIconQueue();
  }, Math.max(0, delay));
}

async function runIconJob(job) {
  let lastError = null;
  for (let attempt = 0; attempt <= ICON_BACKOFF.length; attempt += 1) {
    try {
      job.resolve(await fetchIconOnce(job.url));
      return;
    } catch (error) {
      lastError = error;
      if (!error.retryable) break;
      if (error.status === 429) {
        iconCooldownUntil = Math.max(iconCooldownUntil, Date.now() + ICON_COOLDOWN);
      }
      const wait = ICON_BACKOFF[Math.min(attempt, ICON_BACKOFF.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  job.reject(lastError);
}

function pumpIconQueue() {
  const now = Date.now();
  if (!iconPending.length || iconActive >= ICON_CONCURRENCY) return;
  if (now < iconCooldownUntil) {
    scheduleIconPump(iconCooldownUntil - now);
    return;
  }
  if (now < iconNextAt) {
    scheduleIconPump(iconNextAt - now);
    return;
  }
  const job = iconPending.shift();
  iconActive += 1;
  iconNextAt = now + ICON_MIN_INTERVAL;
  runIconJob(job).finally(() => {
    iconActive -= 1;
    pumpIconQueue();
  });
  pumpIconQueue();
}

function enqueueIcon(url) {
  return new Promise((resolve, reject) => {
    iconPending.push({ url, resolve, reject });
    pumpIconQueue();
  });
}

function iconCacheFile(cfg, providerId, prefix, name) {
  return path.join(cfg.paths.data, "market", "icons", providerId, prefix, `${name}.svg`);
}

function iconBodiesFile(cfg, providerId, prefix) {
  return path.join(cfg.paths.data, "market", "icon-bodies", providerId, `${prefix}.json`);
}

const ICON_WAIT_MS = 600;
const ICON_TIMEOUT = Symbol("icon-timeout");
const iconInflight = new Map();
const iconBodyInflight = new Map();

function sanitizeIconBody(body) {
  return String(body ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*["'](?!#)[^"']*["']/gi, "");
}

function iconSvg(cache, name) {
  const canonical = cache.aliases?.[name]?.parent ?? name;
  const icon = cache.icons?.[canonical];
  if (!icon?.body) return null;
  const width = icon.width ?? cache.width ?? 24;
  const height = icon.height ?? cache.height ?? 24;
  const transforms = [];
  if (icon.rotate) transforms.push(`rotate(${icon.rotate} ${width / 2} ${height / 2})`);
  if (icon.hFlip) transforms.push(`translate(${width} 0) scale(-1 1)`);
  if (icon.vFlip) transforms.push(`translate(0 ${height}) scale(1 -1)`);
  const open = transforms.length ? `<g transform="${transforms.join(" ")}">` : "";
  const close = transforms.length ? "</g>" : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${open}${sanitizeIconBody(icon.body)}${close}</svg>`;
}

/** 一次请求取多个图标的数据，按集合缓存；同一集合的请求合并。 */
function loadIconBodies(cfg, provider, prefix, names) {
  const key = `${provider.id}:${prefix}`;
  const running = iconBodyInflight.get(key);
  if (running) return running;
  const promise = (async () => {
    const file = iconBodiesFile(cfg, provider.id, prefix);
    const cache = readCache(file) ?? {
      version: 1,
      width: 24,
      height: 24,
      icons: {},
      aliases: {},
    };
    cache.icons ??= {};
    cache.aliases ??= {};
    const canonical = (name) => cache.aliases?.[name]?.parent ?? name;
    const missing = [...new Set((names ?? []).map(String).filter(Boolean))].filter(
      (name) => !cache.icons[canonical(name)],
    );
    for (let start = 0; start < missing.length; start += 100) {
      const chunk = missing.slice(start, start + 100);
      const url = `${provider.baseUrl}/${prefix}.json?icons=${encodeURIComponent(chunk.join(","))}`;
      const buffer = await enqueueIcon(url);
      const data = JSON.parse(buffer.toString("utf8"));
      Object.assign(cache.icons, data.icons ?? {});
      Object.assign(cache.aliases, data.aliases ?? {});
      if (data.width) cache.width = data.width;
      if (data.height) cache.height = data.height;
    }
    if (missing.length) {
      cache.fetchedAt = Date.now();
      writeCache(file, cache);
    }
    return cache;
  })().finally(() => iconBodyInflight.delete(key));
  iconBodyInflight.set(key, promise);
  return promise;
}

/** 同一图标只排一次队；成功即落盘，失败丢弃以便下次重试。 */
function fetchIconToCache(cfg, provider, prefix, name) {
  const file = iconCacheFile(cfg, provider.id, prefix, name);
  const running = iconInflight.get(file);
  if (running) return running;
  const promise = (async () => {
    let cache = await loadIconBodies(cfg, provider, prefix, [name]);
    if (!iconSvg(cache, name)) cache = await loadIconBodies(cfg, provider, prefix, [name]);
    const svg = iconSvg(cache, name);
    if (!svg) throw new Error("图标不存在");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, svg);
    return Buffer.from(svg);
  })().finally(() => iconInflight.delete(file));
  iconInflight.set(file, promise);
  return promise;
}

/** 页面返回后批量落盘该集合的图标；后台进行，不占浏览器连接。 */
export function prefetchIconFiles(cfg, providerId, prefix, names, { limit = 120 } = {}) {
  let provider;
  try {
    provider = getProvider(cfg, providerId);
  } catch {
    return;
  }
  if (provider.type !== "iconify") return;
  if (!PREFIX.test(String(prefix ?? ""))) return;
  const list = [...new Set((names ?? []).map(String).filter((name) => ICON_NAME.test(name)))].slice(
    0,
    limit,
  );
  if (!list.length) return;
  loadIconBodies(cfg, provider, prefix, list)
    .then((cache) => {
      for (const name of list) {
        const file = iconCacheFile(cfg, provider.id, prefix, name);
        if (existsSync(file)) continue;
        const svg = iconSvg(cache, name);
        if (!svg) continue;
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, svg);
      }
    })
    .catch(() => {});
}

/**
 * 图标预览：命中本地直接返回；未命中时最多等 waitMs，超时抛 pending，
 * 由后台队列继续拉取并落盘，避免长期占用浏览器连接。
 */
export async function loadIconFile(
  cfg,
  { providerId = null, prefix, name, waitMs = ICON_WAIT_MS },
) {
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error("该来源不支持图标文件");
  if (!PREFIX.test(String(prefix ?? "")) || !ICON_NAME.test(String(name ?? ""))) {
    throw new Error("图标名不合法");
  }
  const file = iconCacheFile(cfg, provider.id, prefix, name);
  if (existsSync(file)) return readFileSync(file);
  const pending = fetchIconToCache(cfg, provider, prefix, name);
  pending.catch(() => {});
  const result = await Promise.race([
    pending,
    new Promise((resolve) => setTimeout(() => resolve(ICON_TIMEOUT), waitMs)),
  ]);
  if (result === ICON_TIMEOUT) {
    const error = new Error("图标正在拉取");
    error.pending = true;
    throw error;
  }
  return result;
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
  const { data } = await requestJson(
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
  const data =
    (await cachedJson(cfg, {
      file: collectionCacheFile(cfg, provider.id, prefix),
      url: `${provider.baseUrl}/collection?prefix=${encodeURIComponent(prefix)}`,
      maxAgeMs: Number(provider.cacheHours ?? 24) * 3600 * 1000,
      label: `图标集（${provider.id}/${prefix}）`,
    })) ?? {};
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

function iconSetCategory(meta) {
  const category = String(meta?.category ?? "").trim();
  return category || "other";
}

function iconCategories(collections) {
  const counts = new Map();
  for (const meta of Object.values(collections ?? {})) {
    const key = iconSetCategory(meta);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export async function browseIconify(
  cfg,
  { providerId = null, category = "", query = "", offset = 0, limit = null } = {},
) {
  const provider = getProvider(cfg, providerId);
  if (provider.type !== "iconify") throw new Error(`不支持的 provider type：${provider.type}`);
  const collections = await loadCollections(cfg, provider.id);
  const cat = String(category ?? "").trim().toLowerCase();
  const text = String(query ?? "").trim().toLowerCase();
  let list = Object.entries(collections).map(([prefix, meta]) => ({
    prefix,
    meta,
    category: iconSetCategory(meta),
  }));
  if (cat) list = list.filter((item) => item.category.toLowerCase() === cat);
  if (text) {
    list = list.filter(
      (item) =>
        String(item.meta.name ?? item.prefix).toLowerCase().includes(text) ||
        item.prefix.includes(text),
    );
  }
  list.sort((a, b) =>
    String(a.meta.name ?? a.prefix).localeCompare(String(b.meta.name ?? b.prefix)),
  );
  const start = Math.max(0, Number(offset) || 0);
  const defaults = marketDefaults(cfg);
  const count = Math.max(1, Math.min(60, Number(limit ?? defaults.collectionLimit ?? 60)));
  return {
    provider: provider.id,
    category: cat,
    query: text,
    total: list.length,
    offset: start,
    limit: count,
    categories: iconCategories(collections),
    entries: list.slice(start, start + count).map(({ prefix, meta, category: itemCategory }) => ({
      id: prefix,
      provider: provider.id,
      kind: "collection",
      dir: "icons",
      name: meta.name ?? prefix,
      prefix,
      collection: meta.name ?? prefix,
      category: itemCategory,
      license: meta.license?.spdx ?? meta.license?.title ?? "unknown",
      licenseUrl: meta.license?.url ?? null,
      author: meta.author?.name ?? null,
      total: meta.total ?? 0,
      samples: (meta.samples ?? [])
        .slice(0, 3)
        .map((name) => entryOf(provider, `${prefix}:${name}`, collections)),
    })),
  };
}

/* ---------------------------------------------------------------- google fonts */

function requireType(provider, type) {
  if (provider.type !== type) throw new Error(`不支持的 provider type：${provider.type}`);
}

function fontCatalogFile(cfg, providerId) {
  return path.join(cfg.paths.data, "market", `${providerId}.font-catalog.json`);
}

function normalizeFontRecord(item) {
  const id = String(item?.id ?? "").trim();
  const family = String(item?.family ?? id).trim();
  const weights = [
    ...new Set((item?.weights ?? []).map(Number).filter((value) => Number.isFinite(value))),
  ].sort((a, b) => a - b);
  const styles = [...new Set((item?.styles ?? []).map((value) => String(value)))];
  return {
    id,
    family,
    category: item?.category ?? null,
    license: item?.license ?? "unknown",
    weights,
    styles: styles.length ? styles : ["normal"],
    subsets: item?.subsets ?? [],
    subset: item?.defSubset ?? null,
    variable: Boolean(item?.variable),
  };
}

export async function loadFontCatalog(cfg, providerId = null, { force = false } = {}) {
  const provider = getProvider(cfg, providerId);
  requireType(provider, "google-fonts");
  if (!provider.catalogUrl) throw new Error("google-fonts 缺少 catalogUrl");
  const data = await cachedJson(cfg, {
    file: fontCatalogFile(cfg, provider.id),
    url: provider.catalogUrl,
    maxAgeMs: Number(provider.cacheHours ?? 24) * 3600 * 1000,
    label: `字体目录（${provider.id}）`,
    force,
  });
  const list = Array.isArray(data) ? data : Array.isArray(data?.fonts) ? data.fonts : [];
  const fonts = list
    .map(normalizeFontRecord)
    .filter((item) => item.id && item.family && item.weights.length);
  if (!fonts.length) throw new Error("字体目录为空或格式不符");
  return fonts;
}

function fontCssSpec(family, weight, style) {
  return style === "italic" ? `${family}:ital,wght@1,${weight}` : `${family}:wght@${weight}`;
}

function fontCssUrl(provider, family, weight = null, style = "normal") {
  const familyParam = weight ? fontCssSpec(family, weight, style) : family;
  return `${provider.baseUrl}/css2?family=${encodeURIComponent(familyParam)}&display=swap`;
}

function fontFileName(recordId, weight, style) {
  return `${recordId}-${weight}${style === "italic" ? "-italic" : ""}.woff2`;
}

function defaultVariant(record) {
  const weight = record.weights.includes(400) ? 400 : record.weights[0];
  const style = record.styles.includes("normal") ? "normal" : record.styles[0];
  return { weight, style };
}

function fontEntryOf(provider, record, weight, style) {
  return {
    id: `${record.id}:${weight}${style === "italic" ? "-italic" : ""}`,
    provider: provider.id,
    kind: "font",
    dir: "fonts",
    name: record.family,
    family: record.family,
    familyId: record.id,
    weight,
    style,
    collection: record.family,
    category: record.category,
    license: record.license ?? "unknown",
    licenseUrl: null,
    source: `Google Fonts / ${record.family}`,
    url: null,
    preview: fontCssUrl(provider, record.family, weight, style),
    fileName: fontFileName(record.id, weight, style),
    subset: provider.subset ?? "latin",
  };
}

export async function searchGoogleFonts(cfg, query, { limit = null, providerId = null } = {}) {
  const provider = getProvider(cfg, providerId);
  requireType(provider, "google-fonts");
  if (provider.enabled === false) throw new Error(`市场源已停用：${provider.id}`);
  const text = String(query ?? "").trim();
  if (!text) throw new Error("缺少搜索关键词");
  const defaults = marketDefaults(cfg);
  const count = Math.max(1, Math.min(60, Number(limit ?? defaults.searchLimit ?? 24)));
  if (!Number.isFinite(count)) throw new Error("缺少搜索条数");
  const fonts = await loadFontCatalog(cfg, provider.id);
  const lower = text.toLowerCase();
  const matches = fonts.filter(
    (item) => item.family.toLowerCase().includes(lower) || item.id.includes(lower),
  );
  return {
    provider: provider.id,
    query: text,
    total: matches.length,
    entries: matches.slice(0, count).map((item) => {
      const { weight, style } = defaultVariant(item);
      return fontEntryOf(provider, item, weight, style);
    }),
  };
}

function fontCategories(fonts) {
  const counts = new Map();
  for (const record of fonts) {
    const key = String(record.category ?? "").toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

export async function browseGoogleFonts(
  cfg,
  { providerId = null, category = "", query = "", offset = 0, limit = null } = {},
) {
  const provider = getProvider(cfg, providerId);
  requireType(provider, "google-fonts");
  const fonts = await loadFontCatalog(cfg, provider.id);
  const cat = String(category ?? "").trim().toLowerCase();
  const text = String(query ?? "").trim().toLowerCase();
  let list = fonts;
  if (cat) {
    list = list.filter((item) => String(item.category ?? "").toLowerCase() === cat);
  }
  if (text) {
    list = list.filter(
      (item) => item.family.toLowerCase().includes(text) || item.id.includes(text),
    );
  }
  list = list.slice().sort((a, b) => a.family.localeCompare(b.family));
  const start = Math.max(0, Number(offset) || 0);
  const defaults = marketDefaults(cfg);
  const count = Math.max(1, Math.min(240, Number(limit ?? defaults.collectionLimit ?? 120)));
  return {
    provider: provider.id,
    category: cat,
    query: text,
    total: list.length,
    offset: start,
    limit: count,
    categories: fontCategories(fonts),
    entries: list.slice(start, start + count).map((record) => {
      const { weight, style } = defaultVariant(record);
      return fontEntryOf(provider, record, weight, style);
    }),
  };
}

export async function collectionGoogleFonts(
  cfg,
  { providerId = null, prefix, query = "", offset = 0, limit = null } = {},
) {
  const provider = getProvider(cfg, providerId);
  requireType(provider, "google-fonts");
  if (!PREFIX.test(String(prefix ?? ""))) throw new Error("字体族标识不合法");
  const fonts = await loadFontCatalog(cfg, provider.id);
  const record = fonts.find((item) => item.id === prefix);
  if (!record) throw new Error(`未知字体族：${prefix}`);
  const variants = [];
  for (const style of record.styles) {
    for (const weight of record.weights) variants.push({ weight, style });
  }
  const text = String(query ?? "").trim().toLowerCase();
  const filtered = text
    ? variants.filter((variant) => `${variant.weight} ${variant.style}`.includes(text))
    : variants;
  const start = Math.max(0, Number(offset) || 0);
  const defaults = marketDefaults(cfg);
  const count = Math.max(1, Math.min(240, Number(limit ?? defaults.collectionLimit ?? 120)));
  if (!Number.isFinite(count)) throw new Error("缺少集合分页条数");
  return {
    provider: provider.id,
    prefix: record.id,
    name: record.family,
    license: record.license,
    total: filtered.length,
    offset: start,
    limit: count,
    entries: filtered
      .slice(start, start + count)
      .map((variant) => fontEntryOf(provider, record, variant.weight, variant.style)),
  };
}

function parseFontCss(css) {
  const blocks = [];
  const pattern = /(?:\/\*\s*([a-z0-9-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  for (const match of String(css).matchAll(pattern)) {
    const body = match[2];
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (!url) continue;
    blocks.push({
      subset: match[1] ?? null,
      style: /font-style:\s*([a-z]+)/.exec(body)?.[1] ?? "normal",
      weight: /font-weight:\s*([0-9]+)/.exec(body)?.[1] ?? null,
      url: url.trim(),
    });
  }
  return blocks;
}

async function fetchFontCss(provider, family, weight, style) {
  const url = fontCssUrl(provider, family, weight, style);
  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`字体 CSS 请求失败：HTTP ${response.status}`);
  return response.text();
}

function fontVersionRef(url, fallback) {
  const match = /\/s\/[^/]+\/(v\d+)\//.exec(String(url));
  return match ? match[1] : fallback;
}

export async function resolveGoogleFont(cfg, id, { providerId = null } = {}) {
  const match = FONT_ID.exec(String(id ?? ""));
  if (!match) throw new Error("字体 id 格式应为 family-id:weight[-italic]");
  const [, recordId, weightText, italic] = match;
  const weight = Number(weightText);
  const style = italic ? "italic" : "normal";
  const provider = getProvider(cfg, providerId);
  requireType(provider, "google-fonts");
  const fonts = await loadFontCatalog(cfg, provider.id);
  const record = fonts.find((item) => item.id === recordId);
  if (!record) throw new Error(`未知字体：${recordId}`);
  if (!record.weights.includes(weight)) {
    throw new Error(`${record.family} 没有 ${weight} 字重`);
  }
  if (!record.styles.includes(style)) {
    throw new Error(`${record.family} 没有 ${style} 字形`);
  }
  const blocks = parseFontCss(await fetchFontCss(provider, record.family, weight, style));
  const wanted = blocks.filter(
    (block) => (!block.weight || Number(block.weight) === weight) && block.style === style,
  );
  const subset = String(provider.subset ?? "latin");
  const block =
    wanted.find((item) => item.subset === subset) ??
    wanted.find((item) => item.subset === record.subset) ??
    wanted.find((item) => !item.subset) ??
    wanted[0];
  if (!block?.url) throw new Error("字体文件地址解析失败");
  const entry = fontEntryOf(provider, record, weight, style);
  entry.url = block.url;
  entry.providerRef = fontVersionRef(block.url, record.id);
  return entry;
}

/* ---------------------------------------------------------------- dispatch */

export async function marketSearch(cfg, query, options = {}) {
  const provider = getProvider(cfg, options.providerId);
  const next = { ...options, providerId: provider.id };
  return provider.type === "google-fonts"
    ? searchGoogleFonts(cfg, query, next)
    : searchIconify(cfg, query, next);
}

export async function marketCollection(cfg, options = {}) {
  const provider = getProvider(cfg, options.providerId);
  const next = { ...options, providerId: provider.id };
  return provider.type === "google-fonts"
    ? collectionGoogleFonts(cfg, next)
    : collectionIconify(cfg, next);
}

export async function marketBrowse(cfg, options = {}) {
  const provider = getProvider(cfg, options.providerId);
  const next = { ...options, providerId: provider.id };
  return provider.type === "google-fonts"
    ? browseGoogleFonts(cfg, next)
    : browseIconify(cfg, next);
}

export async function marketResolve(cfg, id, options = {}) {
  const provider = options.providerId
    ? getProvider(cfg, options.providerId)
    : defaultProviderFor(cfg, id);
  const next = { ...options, providerId: provider.id };
  return provider.type === "google-fonts"
    ? resolveGoogleFont(cfg, id, next)
    : resolveIconifyIcon(cfg, id, next);
}

/** 未指定 provider 时：`family:weight` 形式的 id 优先交给字体源，其余用第一个启用的源。 */
function defaultProviderFor(cfg, id) {
  if (FONT_ID.test(String(id ?? ""))) {
    const fonts = marketProviderList(cfg).find(
      (provider) => provider.type === "google-fonts" && provider.enabled !== false,
    );
    if (fonts) return fonts;
  }
  return getProvider(cfg);
}

/** 市场条目 → `assets add` 参数；图标与字体共用同一入库路径。 */
export function marketImportArgs(entry, { force = false } = {}) {
  if (!entry?.url) throw new Error("条目缺少下载地址");
  const args = [
    "add",
    entry.url,
    "--kind",
    entry.kind === "font" ? "fonts" : "icons",
    "--name",
    entry.fileName,
    "--license",
    entry.license,
    "--source",
    entry.source,
    "--provider",
    entry.provider,
  ];
  if (entry.providerRef) args.push("--ref", entry.providerRef);
  if (entry.kind === "font") {
    args.push("--family", entry.family, "--weight", String(entry.weight));
    if (entry.style === "italic") args.push("--style", "italic");
  }
  if (force) args.push("--force");
  return args;
}
