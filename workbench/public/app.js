"use strict";

/* ------------------------------------------------------------------ state */

const state = {
  status: null,
  catalog: null,
  library: null,
  outputs: null,
  quality: null,
  config: null,
  parameters: null,
  jobs: null,
  resources: null,
  modules: null,
  page: null,
  modalOpen: false,
  assetTab: "generated",
  creative: {
    data: null,
    projectId: null,
    variantId: null,
    dirty: false,
  },
  genFilters: {
    status: "active",
    category: "",
    layer: "",
    scope: "",
    group: "none",
    q: "",
  },
  footageQuery: "",
  resourceTab: "manifest",
  resourceQuery: "",
  taskStage: "mix",
  taskValues: {},
  selectedJob: null,
  eventSource: null,
  labels: null,
  resourceMode: "local",
  market: {
    providers: null,
    defaults: null,
    providerId: null,
    result: null,
    featured: null,
    collection: null,
    query: "",
    error: null,
  },
  timers: { status: null, jobs: null },
};

const PAGE_META = {
  overview: { title: "概览", subtitle: "素材、模块、任务、成片与质量的一览" },
  resources: { title: "资源", subtitle: "本地素材、字体、音频与在线资源市场" },
  assets: { title: "素材", subtitle: "生成素材与实拍素材浏览、审核" },
  creative: { title: "创意", subtitle: "数据驱动的创意工程：参数、文案、变体与素材" },
  tasks: { title: "任务", subtitle: "按参数运行流水线阶段，查看实时日志" },
  outputs: { title: "成片", subtitle: "已渲染成片与对应时间线摘要" },
  quality: { title: "质量", subtitle: "感知聚类、近似重复与覆盖矩阵" },
};

/* ------------------------------------------------------------------ utils */

const $ = (selector, root = document) => root.querySelector(selector);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

function labelEntry(group, value) {
  return state.labels?.groups?.[group]?.[value] ?? null;
}

function labelOf(group, value) {
  return labelEntry(group, value)?.label ?? String(value ?? "—");
}

function hintOf(group, value) {
  return labelEntry(group, value)?.hint ?? "";
}

function hintAttr(group, value) {
  const hint = hintOf(group, value);
  return hint ? ` data-hint="${esc(hint)}"` : "";
}

function labelWithHint(group, value) {
  const hint = hintOf(group, value);
  const label = esc(labelOf(group, value));
  return hint ? `<span data-hint="${esc(hint)}">${label}</span>` : label;
}

const qhint = (key) => hintAttr("qualityMetric", key);

const qmark = (key) => {
  const hint = hintOf("qualityMetric", key);
  return hint ? `<span class="hint-dot" data-hint="${esc(hint)}">?</span>` : "";
};

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error ?? `请求失败：${response.status}`);
  }
  return data;
}

function postJson(path, body) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fmtDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${minutes}:${rest}`;
  }
  return `${seconds.toFixed(1)}s`;
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fmtNum(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function fmtPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function categoryLabel(value) {
  return labelOf("category", value);
}

function layerLabel(value) {
  return labelOf("layer", value);
}

function statusLabel(value) {
  return labelOf("status", value);
}

function flagLabel(value) {
  return labelOf("qualityFlag", value);
}

function stageLabel(value) {
  return labelOf("stage", value);
}

function jobStatusBadge(status) {
  const cls =
    status === "running" ? "accent" : status === "done" ? "ok" : status === "failed" ? "danger" : status === "queued" ? "warn" : "";
  return `<span class="badge ${cls}">${esc(labelOf("jobStatus", status))}</span>`;
}

function statusBadge(status) {
  const cls = status === "approved" ? "ok" : status === "draft" ? "warn" : "danger";
  return `<span class="badge ${cls}">${esc(statusLabel(status))}</span>`;
}

/* ------------------------------------------------------------------ video handles */

function releaseVideos() {
  for (const video of document.querySelectorAll("video")) {
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
    } catch {
      /* ignore */
    }
  }
  for (const audio of document.querySelectorAll("audio")) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {
      /* ignore */
    }
  }
}

const PREVIEW_MODES = [
  { key: "dark", label: "深色" },
  { key: "light", label: "浅色" },
  { key: "checker", label: "棋盘" },
];

function applyPreviewMode(key) {
  const mode = PREVIEW_MODES.find((item) => item.key === key) ?? PREVIEW_MODES[0];
  document.body.dataset.preview = mode.key;
  const button = $("#previewBg");
  if (button) button.textContent = `预览底色：${mode.label}`;
  try {
    localStorage.setItem("vp.previewBg", mode.key);
  } catch {
    /* ignore */
  }
}

function initPreviewMode() {
  let saved = "checker";
  try {
    saved = localStorage.getItem("vp.previewBg") ?? "checker";
  } catch {
    /* ignore */
  }
  applyPreviewMode(saved);
  const button = $("#previewBg");
  if (!button) return;
  button.onclick = () => {
    const current = document.body.dataset.preview ?? "dark";
    const index = PREVIEW_MODES.findIndex((item) => item.key === current);
    applyPreviewMode(PREVIEW_MODES[(index + 1) % PREVIEW_MODES.length].key);
  };
}

/* ------------------------------------------------------------------ toast */

let toastTimer = null;
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, 3200);
}

/* ------------------------------------------------------------------ modal */

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modal").hidden = false;
  state.modalOpen = true;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!state.modalOpen) return;
  releaseVideos();
  $("#modal").hidden = true;
  $("#modalBody").innerHTML = "";
  state.modalOpen = false;
  document.body.style.overflow = "";
}

/* ------------------------------------------------------------------ loaders */

async function loadStatus(force = false) {
  if (state.status && !force) return state.status;
  state.status = await api("/api/status");
  renderChrome();
  return state.status;
}

async function loadConfig() {
  if (state.config) return state.config;
  state.config = await api("/api/config");
  renderChrome();
  return state.config;
}

async function loadParameters() {
  if (state.parameters) return state.parameters;
  state.parameters = await api("/api/parameters");
  return state.parameters;
}

async function loadCatalog(force = false) {
  if (state.catalog && !force) return state.catalog;
  state.catalog = (await api("/api/catalog")).assets ?? [];
  return state.catalog;
}

async function loadLibrary(force = false) {
  if (state.library && !force) return state.library;
  state.library = (await api("/api/library")).assets ?? [];
  return state.library;
}

async function loadOutputs(force = false) {
  if (state.outputs && !force) return state.outputs;
  state.outputs = (await api("/api/outputs")).outputs ?? [];
  return state.outputs;
}

async function loadQuality(force = false) {
  if (state.quality && !force) return state.quality;
  state.quality = await api("/api/quality");
  return state.quality;
}

async function loadCreative(force = false) {
  if (state.creative.data && !force) return state.creative.data;
  state.creative.data = await api("/api/creative");
  return state.creative.data;
}

async function loadJobs(force = false) {
  if (state.jobs && !force) return state.jobs;
  state.jobs = await api("/api/jobs");
  return state.jobs;
}

async function loadResources(force = false) {
  if (state.resources && !force) return state.resources;
  state.resources = await api("/api/resources");
  return state.resources;
}

async function loadModules(force = false) {
  if (state.modules && !force) return state.modules;
  state.modules = await api("/api/modules");
  return state.modules;
}

async function loadLabels() {
  if (state.labels) return state.labels;
  state.labels = await api("/api/labels");
  renderChrome();
  return state.labels;
}

async function loadMarketProviders() {
  if (state.market.providers) return state.market.providers;
  const data = await api("/api/market/providers");
  state.market.providers = data.providers ?? {};
  state.market.defaults = data.defaults ?? {};
  if (!state.market.providerId) {
    state.market.providerId =
      Object.keys(state.market.providers).find(
        (id) => state.market.providers[id]?.enabled !== false,
      ) ?? Object.keys(state.market.providers)[0] ?? null;
  }
  return state.market.providers;
}

/* ------------------------------------------------------------------ chrome */

function renderChrome() {
  const spec = state.config?.spec;
  if (spec) {
    $("#brandSpec").textContent = `${spec.width}×${spec.height} · ${spec.fps}fps`;
  }

  const counts = state.status?.counts;
  if (counts) {
    $("#sideCounts").innerHTML = `
      <span>实拍 <b>${counts.footage}</b></span>
      <span>生成 <b>${counts.catalog}</b></span>
      <span>待审 <b>${counts.draft}</b></span>
      <span>成片 <b>${counts.outputs}</b>
    `;
  }

  const badge = $("#jobBadge");
  const current = state.status?.current;
  const queued = state.status?.queue?.[0];
  const job = current ?? queued;
  if (!job) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  badge.classList.toggle("is-queued", !current);
  $("#jobBadgeStage").textContent = stageLabel(job.stage);
  $("#jobBadgeStatus").textContent = current ? "运行中" : `排队 ${state.status.queue.length}`;
}

/* ------------------------------------------------------------------ routing */

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "").split("?")[0];
  return PAGE_META[hash] ? hash : "overview";
}

async function route() {
  const page = currentRoute();
  state.page = page;

  closeModal();
  releaseVideos();
  closeEventSource();
  clearPageTimers();

  for (const link of document.querySelectorAll("#nav a")) {
    link.classList.toggle("active", link.dataset.page === page);
  }

  const meta = PAGE_META[page];
  $("#pageTitle").textContent = meta.title;
  $("#pageSubtitle").textContent = meta.subtitle;
  $("#pageActions").innerHTML = "";
  $("#view").onclick = null;
  $("#view").innerHTML = `<div class="empty"><strong>加载中</strong></div>`;

  try {
    if (page === "overview") await renderOverview();
    else if (page === "resources") await renderResources();
    else if (page === "assets") await renderAssets();
    else if (page === "creative") await renderCreative();
    else if (page === "tasks") await renderTasks();
    else if (page === "outputs") await renderOutputs();
    else if (page === "quality") await renderQuality();
  } catch (error) {
    $("#view").innerHTML = `<div class="empty"><strong>加载失败</strong>${esc(error.message)}</div>`;
    toast(error.message);
  }
}

function setActions(html) {
  $("#pageActions").innerHTML = html;
}

/* ------------------------------------------------------------------ overview */

let lastOverviewSignature = null;

async function renderOverview() {
  const [status, modules] = await Promise.all([
    loadStatus(true),
    loadModules(true),
  ]);
  const counts = status.counts;
  const quality = status.quality;
  const outputs = status.recentOutputs ?? [];
  const current = status.current;

  lastOverviewSignature = overviewSignature(status);
  setActions(`<button class="btn" id="refreshOverview">刷新</button>`);

  const jobPanel = current
    ? `<div class="panel">
        <div class="panel-head"><h2>当前任务</h2><span class="meta">${esc(fmtDate(current.startedAt))}</span></div>
        <div class="row">
          ${jobStatusBadge(current.status)}
          <strong>${esc(stageLabel(current.stage))}</strong>
          <span class="mono faint">${esc(current.args.join(" ")) || "无参数"}</span>
          <span class="spacer"></span>
          <button class="btn" id="gotoTasks">查看日志</button>
        </div>
      </div>`
    : status.queue?.length
      ? `<div class="panel">
          <div class="panel-head"><h2>任务队列</h2><span class="meta">${status.queue.length} 个等待</span></div>
          <div class="row">${status.queue
            .slice(0, 5)
            .map(
              (job) =>
                `<span class="chip">${esc(stageLabel(job.stage))}</span>`,
            )
            .join("")}</div>
        </div>`
      : "";

  const outputPanel = outputs.length
    ? `<div class="panel">
        <div class="panel-head"><h2>最近成片</h2><button class="btn" id="gotoOutputs">全部成片</button></div>
        <div class="job-list">
          ${outputs
            .map(
              (output) => `
            <div class="job-item" data-output="${esc(output.id)}">
              <span class="stage">${fmtDuration(output.duration)}</span>
              <span class="args">${esc(output.id)}</span>
              <span class="when">${fmtBytes(output.size)}</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>`
    : `<div class="empty">
        <strong>还没有成片</strong>
        先扫描、生成、审核素材，再规划成片。
        <code>node run.mjs mix --duration 15 --dry-run</code>
      </div>`;

  const qualityPanel = quality
    ? `<div class="panel">
        <div class="panel-head"><h2>质量摘要</h2><button class="btn" id="gotoQuality">质量报告</button></div>
        <div class="stats">
          <div class="stat"><div class="label"${qhint("analyzed")}>已分析${qmark("analyzed")}</div><div class="value">${quality.analyzed ?? "—"}</div><div class="hint">共 ${quality.assets ?? "—"} 条</div></div>
          <div class="stat"><div class="label"${qhint("clusters")}>感知簇${qmark("clusters")}</div><div class="value">${quality.clusters ?? "—"}</div><div class="hint">多样性 ${fmtNum(quality.diversity, 3)}</div></div>
          <div class="stat"><div class="label"${qhint("nearDuplicates")}>近似重复${qmark("nearDuplicates")}</div><div class="value">${quality.nearDuplicates ?? "—"}</div><div class="hint">对</div></div>
          <div class="stat"><div class="label"${qhint("warnings")}>警告${qmark("warnings")}</div><div class="value">${quality.warnings ?? 0}</div><div class="hint">失败 ${quality.flagged ?? 0}</div></div>
        </div>
      </div>`
    : "";

  $("#view").innerHTML = `
    <div class="stats">
      <div class="stat"><div class="label">实拍素材</div><div class="value">${counts.footage}</div><div class="hint">扫描入库</div></div>
      <div class="stat"><div class="label">生成素材</div><div class="value">${counts.catalog}</div><div class="hint">已批准 ${counts.approved} · 待审核 ${counts.draft}</div></div>
      <div class="stat"><div class="label">作品</div><div class="value">${counts.works}</div><div class="hint">专属素材作品</div></div>
      <div class="stat"><div class="label">成片</div><div class="value">${counts.outputs}</div><div class="hint">${counts.retired ? `退役素材 ${counts.retired}` : "out/ 目录"}</div></div>
    </div>
    ${jobPanel}
    <h2 class="section-title">模块状态</h2>
    <div class="grid module-grid">
      ${modules.modules.map(moduleCardHtml).join("")}
    </div>
    ${outputPanel}
    ${qualityPanel}
  `;

  const refresh = $("#refreshOverview");
  if (refresh) refresh.onclick = () => route();
  const gotoTasks = $("#gotoTasks");
  if (gotoTasks) gotoTasks.onclick = () => (location.hash = "#/tasks");
  const gotoOutputs = $("#gotoOutputs");
  if (gotoOutputs) gotoOutputs.onclick = () => (location.hash = "#/outputs");
  const gotoQuality = $("#gotoQuality");
  if (gotoQuality) gotoQuality.onclick = () => (location.hash = "#/quality");

  for (const button of document.querySelectorAll("[data-module-check]")) {
    button.onclick = () => runModuleCheck(button.dataset.moduleCheck);
  }

  for (const node of document.querySelectorAll("[data-output]")) {
    node.onclick = () => (location.hash = "#/outputs");
  }
}

function overviewSignature(status) {
  return JSON.stringify([
    status.counts,
    status.current?.id,
    status.current?.status,
    status.queue?.length,
    status.recentOutputs?.map((output) => output.id),
    status.quality?.generatedAt,
  ]);
}

/* ------------------------------------------------------------------ market-in-resources */

function resourceModeSwitch() {
  return `<div class="tabs" id="resourceMode">
    <button data-resource-mode="local"${hintAttr("resourceMode", "local")} class="${state.resourceMode === "local" ? "active" : ""}">${esc(labelOf("resourceMode", "local"))}</button>
    <button data-resource-mode="market"${hintAttr("resourceMode", "market")} class="${state.resourceMode === "market" ? "active" : ""}">${esc(labelOf("resourceMode", "market"))}</button>
  </div>`;
}

function bindResourceMode() {
  for (const button of document.querySelectorAll("#resourceMode button")) {
    button.onclick = () => {
      state.resourceMode = button.dataset.resourceMode;
      state.market.result = null;
      state.market.featured = null;
      state.market.collection = null;
      route();
    };
  }
}

function marketSourcesHtml(providers) {
  const list = Object.entries(providers);
  if (!list.length) {
    return `<div class="empty"><strong>还没有市场来源</strong>点击“添加来源”添加一个 Iconify 兼容源。</div>`;
  }
  return `<details class="panel market-sources-panel">
    <summary>市场来源 <span class="meta">${list.length} 个 · ${esc(list.map(([, provider]) => provider.label ?? "—").join("、"))}</span></summary>
    <div class="table-wrap" id="marketSources"><table class="data market-source-table">
      <thead><tr><th>名称</th><th>类型</th><th>baseUrl</th><th>缓存</th><th>推荐</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>
        ${list
          .map(([id, provider]) => {
            const enabled = provider.enabled !== false;
            return `<tr>
              <td><strong>${esc(provider.label ?? id)}</strong><div class="faint mono">${esc(id)}</div></td>
              <td>${esc(provider.type ?? "—")}</td>
              <td class="mono">${esc(provider.baseUrl ?? "—")}</td>
              <td>${esc(provider.cacheHours ?? "—")}h</td>
              <td>${esc((provider.featured ?? []).join(", ") || "—")}</td>
              <td><span class="badge ${enabled ? "ok" : "warn"}">${enabled ? "启用" : "停用"}</span></td>
              <td>
                <button class="btn" data-provider-toggle="${esc(id)}">${enabled ? "停用" : "启用"}</button>
                <button class="btn" data-provider-edit="${esc(id)}">编辑</button>
                <button class="btn danger" data-provider-remove="${esc(id)}">移除</button>
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table></div>
  </details>`;
}

function importedIconPath(entry) {
  return `icons/${entry.fileName}`;
}

function isIconImported(entry) {
  return (state.resources?.entries ?? []).some(
    (item) => item.path === importedIconPath(entry),
  );
}

function marketCardHtml(entry) {
  const imported = isIconImported(entry);
  return `
    <article class="asset-card market-card">
      <div class="asset-thumb">
        <button class="market-preview" data-market-preview="${esc(entry.id)}" data-provider-id="${esc(entry.provider)}" title="预览 ${esc(entry.id)}">
          <img src="${esc(entry.preview)}" alt="" loading="lazy" />
        </button>
      </div>
      <div class="asset-body">
        <div class="asset-title">${esc(entry.id)}</div>
        <div class="asset-sub"><span>${esc(entry.license)}</span><span>${esc(entry.collection)}</span></div>
        <button class="btn ${imported ? "" : "primary"}" data-import-icon="${esc(entry.id)}" data-provider-id="${esc(entry.provider)}" ${imported ? "disabled" : ""}>${imported ? "已导入" : "导入"}</button>
      </div>
    </article>`;
}

function renderMarketResults() {
  const result = state.market.result;
  if (!result) return "";
  if (!result.entries?.length) {
    return `<div class="empty"><strong>没有匹配的图标</strong>换个关键词试试。</div>`;
  }
  return `
    <div class="row" style="justify-content:space-between">
      <strong>${result.entries.length} / ${result.total} 条</strong>
      <span class="faint">点击图标预览；导入后写入 assets/icons/ 并登记清单</span>
    </div>
    <div class="grid market-grid">
      ${result.entries.map(marketCardHtml).join("")}
    </div>`;
}

function renderFeaturedHtml() {
  if (state.market.error) return "";
  const provider = state.market.providers?.[state.market.providerId];
  const chips = provider?.suggestions ?? [];
  const featured = state.market.featured;
  return `
    ${
      chips.length
        ? `<div class="row" style="flex-wrap:wrap"><span class="faint">试试：</span>${chips.map((query) => `<button class="btn" data-market-query="${esc(query)}">${esc(query)}</button>`).join("")}</div>`
        : ""
    }
    <h2 class="section-title">推荐图标集</h2>
    ${
      featured
        ? `<div class="grid market-collections">${featured.collections
            .map(
              (collection) => `
            <div class="panel market-collection">
              <div class="panel-head"><h2>${esc(collection.name)}</h2><span class="meta">${esc(collection.license)} · ${collection.total} 个</span></div>
              <div class="market-samples">
                ${collection.samples
                  .map(
                    (entry) => `<button class="market-sample" data-market-preview="${esc(entry.id)}" data-provider-id="${esc(entry.provider)}" title="预览 ${esc(entry.id)}"><img src="${esc(entry.preview)}" alt="" loading="lazy" /></button>`,
                  )
                  .join("")}
              </div>
              <div class="row" style="margin-top:10px">
                <button class="btn" data-market-collection="${esc(collection.prefix)}" data-provider-id="${esc(featured.provider)}">浏览全部 ${collection.total}</button>
              </div>
            </div>`,
            )
            .join("")}</div>`
        : `<div class="empty"><strong>推荐加载中</strong>正在读取图标集元数据。</div>`
    }`;
}

function renderCollectionHtml() {
  const collection = state.market.collection;
  if (!collection) return "";
  if (collection.loading && !collection.entries.length) {
    return `<div class="empty"><strong>加载图标集</strong>正在读取 ${esc(collection.prefix)}。</div>`;
  }
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>${esc(collection.name || collection.prefix)}</h2>
        <span class="meta">${esc(collection.license || "—")} · ${collection.total} 个图标</span>
        <button class="btn" data-market-back>返回市场</button>
      </div>
      <div class="toolbar">
        <input class="field search" id="collectionQuery" placeholder="在 ${esc(collection.name || collection.prefix)} 内搜索" value="${esc(collection.query)}" />
        <button class="btn" id="collectionSearch">搜索</button>
        <span class="faint">已显示 ${collection.entries.length}/${collection.total}</span>
      </div>
      ${collection.error ? `<div class="row"><span class="badge danger">加载失败</span><span>${esc(collection.error)}</span></div>` : ""}
      ${collection.entries.length ? `<div class="grid market-grid">${collection.entries.map(marketCardHtml).join("")}</div>` : `<div class="empty"><strong>没有匹配的图标</strong>换个关键词。</div>`}
      ${
        collection.entries.length < collection.total
          ? `<div class="row"><button class="btn" id="collectionMore">加载更多</button></div>`
          : ""
      }
    </div>`;
}

function marketLimit(name) {
  const provider = state.market.providers?.[state.market.providerId];
  return provider?.[name] ?? state.market.defaults?.[name];
}

async function loadMarketCollection({ append = false } = {}) {
  const collection = state.market.collection;
  if (!collection) return;
  const offset = append ? collection.entries.length : 0;
  collection.loading = true;
  collection.error = null;
  try {
    const data = await api(
      `/api/market/collection?provider=${encodeURIComponent(collection.providerId)}&prefix=${encodeURIComponent(collection.prefix)}&q=${encodeURIComponent(collection.query)}&offset=${offset}&limit=${encodeURIComponent(marketLimit("collectionLimit") ?? "")}`,
    );
    collection.name = data.name;
    collection.license = data.license;
    collection.total = data.total;
    collection.entries = append
      ? [...collection.entries, ...data.entries]
      : data.entries;
  } catch (error) {
    collection.error = error.message;
  }
  collection.loading = false;
}

async function openMarketCollection(prefix, providerId) {
  state.market.collection = {
    providerId,
    prefix,
    name: "",
    license: "",
    total: 0,
    entries: [],
    query: "",
    loading: true,
    error: null,
  };
  await loadMarketCollection();
  route();
}

function bindMarketResults(providerId) {
  const container = $("#marketResults");
  if (!container) return;
  container.onclick = async (event) => {
    const queryButton = event.target.closest("[data-market-query]");
    if (queryButton) {
      $("#marketQuery").value = queryButton.dataset.marketQuery;
      const search = $("#marketSearch");
      if (search) search.click();
      return;
    }
    const collectionButton = event.target.closest("[data-market-collection]");
    if (collectionButton) {
      openMarketCollection(
        collectionButton.dataset.marketCollection,
        collectionButton.dataset.providerId || providerId,
      );
      return;
    }
    const previewButton = event.target.closest("[data-market-preview]");
    if (previewButton) {
      openMarketPreview(
        previewButton.dataset.marketPreview,
        previewButton.dataset.providerId || providerId,
      );
      return;
    }
    const importButton = event.target.closest("[data-import-icon]");
    if (!importButton) return;
    importButton.disabled = true;
    try {
      const result = await postJson("/api/market/import", {
        icon: importButton.dataset.importIcon,
        provider: importButton.dataset.providerId || providerId,
      });
      toast(`已提交导入 → assets/icons/${result.entry?.fileName ?? ""}`);
      watchToolJob(result.job, "导入图标");
    } catch (error) {
      importButton.disabled = false;
      toast(error.message);
    }
  };
}

async function renderResourceMarket() {
  const providers = state.market.providers ?? {};
  const enabled = Object.entries(providers).filter(
    ([, provider]) => provider.enabled !== false,
  );
  if (!enabled.some(([id]) => id === state.market.providerId)) {
    state.market.providerId = enabled[0]?.[0] ?? null;
  }
  const providerId = state.market.providerId;
  const provider = providerId ? providers[providerId] : null;

  if (state.market.collection) {
    setActions(`<button class="btn" id="resourceRefresh">刷新</button>`);
    $("#view").innerHTML = `
      ${resourceModeSwitch()}
      <div id="marketResults">${renderCollectionHtml()}</div>
    `;
    bindResourceMode();
    bindMarketResults(providerId);
    $("#resourceRefresh").onclick = () => route();
    const back = document.querySelector("[data-market-back]");
    if (back) {
      back.onclick = () => {
        state.market.collection = null;
        route();
      };
    }
    const runCollectionSearch = async () => {
      const input = $("#collectionQuery");
      state.market.collection.query = input ? input.value.trim() : "";
      await loadMarketCollection();
      route();
    };
    const searchButton = $("#collectionSearch");
    if (searchButton) searchButton.onclick = runCollectionSearch;
    const queryInput = $("#collectionQuery");
    if (queryInput) {
      queryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runCollectionSearch();
      });
    }
    const more = $("#collectionMore");
    if (more) {
      more.onclick = async () => {
        more.disabled = true;
        await loadMarketCollection({ append: true });
        route();
      };
    }
    return;
  }

  if (providerId && !state.market.result && !state.market.featured) {
    try {
      state.market.featured = await api(
        `/api/market/featured?provider=${encodeURIComponent(providerId)}`,
      );
    } catch (error) {
      state.market.error = error.message;
    }
  }

  setActions(`
    <button class="btn" id="resourceRefresh">刷新</button>
    <button class="btn primary" id="providerAdd">添加来源</button>
  `);

  $("#view").innerHTML = `
    ${resourceModeSwitch()}
    ${marketSourcesHtml(providers)}
    <div class="panel">
      <div class="panel-head"><h2>搜索素材</h2><span class="meta">${provider ? esc(provider.label ?? providerId) : "没有启用来源"}</span></div>
      <div class="toolbar">
        <select class="field" id="marketProvider">
          ${enabled.map(([id, item]) => `<option value="${esc(id)}" ${id === providerId ? "selected" : ""}>${esc(item.label ?? id)}</option>`).join("") || `<option value="">无</option>`}
        </select>
        <input class="field search" id="marketQuery" placeholder="${esc(provider?.searchPlaceholder ?? "搜索图标")}" value="${esc(state.market.query)}" />
        <button class="btn primary" id="marketSearch">搜索</button>
      </div>
      <p class="faint">来源可添加、编辑、停用或移除；导入仍走 <code>assets add</code>，许可/来源写入清单。</p>
    </div>
    ${state.market.error ? `<div class="panel"><div class="row"><span class="badge danger">市场错误</span><span>${esc(state.market.error)}</span></div></div>` : ""}
    <div id="marketResults">${state.market.query ? renderMarketResults() : renderFeaturedHtml()}</div>
  `;

  bindResourceMode();
  $("#resourceRefresh").onclick = () => route();
  $("#providerAdd").onclick = () => openProviderEditor(null);
  $("#marketProvider").onchange = (event) => {
    state.market.providerId = event.target.value;
    state.market.result = null;
    state.market.featured = null;
    state.market.collection = null;
    state.market.error = null;
    route();
  };

  const runSearch = async () => {
    const query = $("#marketQuery").value.trim();
    if (!query) {
      toast("请输入搜索关键词");
      return;
    }
    state.market.query = query;
    state.market.error = null;
    try {
      state.market.result = await api(
        `/api/market/search?provider=${encodeURIComponent(providerId ?? "")}&q=${encodeURIComponent(query)}&limit=${encodeURIComponent(marketLimit("searchLimit") ?? "")}`,
      );
    } catch (error) {
      state.market.result = null;
      state.market.error = error.message;
    }
    route();
  };
  $("#marketSearch").onclick = runSearch;
  $("#marketQuery").addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });

  bindMarketResults(providerId);

  const sources = $("#marketSources");
  if (sources) {
    sources.onclick = (event) => {
      const toggle = event.target.closest("[data-provider-toggle]");
      if (toggle) {
        const id = toggle.dataset.providerToggle;
        const nextEnabled = providers[id]?.enabled === false;
        submitProvider(
          { action: "set", id, enabled: nextEnabled },
          `已${nextEnabled ? "启用" : "停用"} ${id}`,
        );
        return;
      }
      const edit = event.target.closest("[data-provider-edit]");
      if (edit) {
        openProviderEditor(edit.dataset.providerEdit);
        return;
      }
      const remove = event.target.closest("[data-provider-remove]");
      if (remove) {
        const id = remove.dataset.providerRemove;
        if (!window.confirm(`移除市场来源 ${id}？`)) return;
        submitProvider({ action: "remove", id }, `已移除 ${id}`);
      }
    };
  }
}

function resetMarketState() {
  state.market.providers = null;
  state.market.result = null;
  state.market.featured = null;
  state.market.collection = null;
  state.market.query = "";
  state.market.error = null;
}

async function submitProvider(body, message) {
  try {
    const job = await postJson("/api/market/providers", body);
    resetMarketState();
    toast(message);
    watchToolJob(job, "市场来源");
  } catch (error) {
    toast(error.message);
  }
}

function findMarketEntry(icon, providerId) {
  const candidates = [
    ...(state.market.result?.entries ?? []),
    ...(state.market.featured?.collections ?? []).flatMap(
      (collection) => collection.samples ?? [],
    ),
  ];
  return (
    candidates.find(
      (entry) =>
        entry.id === icon && (!providerId || entry.provider === providerId),
    ) ?? null
  );
}

function openMarketPreview(icon, providerId) {
  const entry = findMarketEntry(icon, providerId);
  if (!entry) {
    toast("找不到该图标条目，请重新搜索");
    return;
  }
  const existing = isIconImported(entry);
  const target = `assets/${importedIconPath(entry)}`;
  openModal(`预览 · ${entry.id}`, `
    <div class="asset-detail market-preview-detail">
      <div class="preview-box market-preview-box"><img src="${esc(entry.preview)}" alt="" /></div>
      <div>
        <div class="row">
          <span class="badge accent">${esc(entry.license)}</span>
          <span class="badge">${esc(entry.collection)}</span>
          ${existing ? `<span class="badge ok">已导入</span>` : `<span class="badge warn">未导入</span>`}
        </div>
        <div class="kv">
          <div><div class="k">id</div><div class="v">${esc(entry.id)}</div></div>
          <div><div class="k">来源</div><div class="v">${esc(entry.source)}</div></div>
          <div><div class="k">作者</div><div class="v">${esc(entry.author ?? "—")}</div></div>
          <div><div class="k">许可</div><div class="v">${esc(entry.license)}${entry.licenseUrl ? ` · ${esc(entry.licenseUrl)}` : ""}</div></div>
          <div><div class="k">目标路径</div><div class="v mono">${esc(target)}</div></div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="marketImport">${existing ? "重新导入（覆盖）" : "导入到素材库"}</button>
          <span class="faint" id="marketImportStatus"></span>
        </div>
      </div>
    </div>
  `);
  $("#marketImport").onclick = async () => {
    const button = $("#marketImport");
    const status = $("#marketImportStatus");
    button.disabled = true;
    status.textContent = "提交中…";
    try {
      const result = await postJson("/api/market/import", {
        icon: entry.id,
        provider: entry.provider,
        force: existing,
      });
      status.textContent = `已提交导入 → ${target}`;
      toast(`导入任务已提交 → ${target}`);
      watchToolJob(result.job, "导入图标");
    } catch (error) {
      button.disabled = false;
      status.textContent = "";
      toast(error.message);
    }
  };
}

function openProviderEditor(id) {
  const provider = id ? state.market.providers?.[id] : null;
  const defaults = state.market.defaults ?? {};
  openModal(id ? `编辑市场来源 · ${id}` : "添加市场来源", `
    <div class="form-grid">
      <div class="form-row"><label for="providerId">id</label><input class="field" id="providerId" value="${esc(id ?? "")}" ${id ? "disabled" : ""} placeholder="iconify-2" /></div>
      <div class="form-row"><label for="providerType">type</label><input class="field" id="providerType" value="${esc(provider?.type ?? defaults.type ?? "")}" disabled /></div>
      <div class="form-row"><label for="providerLabel">label</label><input class="field" id="providerLabel" value="${esc(provider?.label ?? "")}" placeholder="显示名称" /></div>
      <div class="form-row"><label for="providerBaseUrl">baseUrl</label><input class="field" id="providerBaseUrl" value="${esc(provider?.baseUrl ?? defaults.baseUrl ?? "")}" placeholder="http(s)://..." /></div>
      <div class="form-row"><label for="providerFeatured">featured</label><input class="field" id="providerFeatured" value="${esc((provider?.featured ?? []).join(","))}" placeholder="逗号分隔的图标集前缀" /></div>
      <div class="form-row"><label for="providerSuggestions">suggestions</label><input class="field" id="providerSuggestions" value="${esc((provider?.suggestions ?? []).join(","))}" placeholder="逗号分隔的快捷搜索词" /></div>
      <div class="form-row"><label for="providerSearchPlaceholder">searchPlaceholder</label><input class="field" id="providerSearchPlaceholder" value="${esc(provider?.searchPlaceholder ?? defaults.searchPlaceholder ?? "")}" /></div>
      <div class="form-row"><label for="providerCache">cacheHours</label><input class="field" id="providerCache" type="number" min="1" value="${esc(provider?.cacheHours ?? defaults.cacheHours ?? "")}" /></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="saveProvider">保存</button></div>
  `);
  $("#saveProvider").onclick = () => {
    const nextId = id ?? $("#providerId").value.trim();
    if (!nextId) {
      toast("请填写市场源 id");
      return;
    }
    const body = {
      action: id ? "set" : "add",
      id: nextId,
      type: $("#providerType").value.trim(),
      label: $("#providerLabel").value.trim() || nextId,
      baseUrl: $("#providerBaseUrl").value.trim(),
      featured: $("#providerFeatured").value.trim(),
      suggestions: $("#providerSuggestions").value.trim(),
      searchPlaceholder: $("#providerSearchPlaceholder").value.trim(),
      cacheHours: Number($("#providerCache").value),
    };
    closeModal();
    submitProvider(body, id ? "市场来源已更新" : "市场来源已添加");
  };
}

/* ------------------------------------------------------------------ resources */

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|svg)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|flac)$/i;

function statCard(label, value, hint = "", tip = "") {
  return `<div class="stat"><span class="label"${tip ? ` data-hint="${esc(tip)}"` : ""}>${esc(label)}</span><span class="value">${esc(value)}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}

function resourceLicenseBadge(license) {
  return !license || license === "unknown"
    ? `<span class="badge warn">许可未知</span>`
    : `<span class="badge ok">${esc(license)}</span>`;
}

function resourceFilter(list, keys) {
  const query = state.resourceQuery.trim().toLowerCase();
  if (!query) return list;
  return list.filter((item) =>
    keys.some((key) => String(item[key] ?? "").toLowerCase().includes(query)),
  );
}

function resourcePreview(item) {
  const file = item.path ?? item.file ?? "";
  if (item.media && IMAGE_EXT.test(file)) {
    return `<img class="resource-thumb" src="${esc(item.media)}" alt="" loading="lazy" />`;
  }
  if (item.media && AUDIO_EXT.test(file)) {
    return `<button class="btn" data-audio-src="${esc(item.media)}" data-audio-title="${esc(item.id ?? item.path ?? "音频")}">试听</button>`;
  }
  return `<span class="faint">—</span>`;
}

function resourceTableHtml(headers, rows) {
  if (!rows.length) {
    return `<div class="empty"><strong>没有匹配项</strong>调整搜索或切换标签。</div>`;
  }
  return `<div class="table-wrap"><table class="data">
    <thead><tr>${headers.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function resourceIssuesHtml(issues, requirements) {
  const rows = [];
  for (const item of issues.missing) {
    rows.push(`缺失文件 <code>${esc(item.path)}</code>（${esc(item.kind)}）`);
  }
  for (const item of issues.unregistered) {
    rows.push(`未登记 <code>${esc(item.path)}</code>`);
  }
  for (const item of issues.changed) {
    rows.push(`哈希变化 <code>${esc(item.path)}</code>（运行“扫描素材”更新）`);
  }
  for (const item of issues.brokenAudio) {
    rows.push(`音频文件缺失 <code>${esc(item.kind)}/${esc(item.id)}</code>`);
  }
  for (const item of issues.licenses.unknown) {
    rows.push(`许可未知 <code>${esc(item.path)}</code>`);
  }
  for (const item of issues.meta.fonts) {
    rows.push(`字体缺元数据 <code>${esc(item.path)}</code>`);
  }
  for (const item of issues.meta.audio) {
    rows.push(
      `音频缺 ${esc(item.missing.join("/"))} <code>${esc(item.kind)}/${esc(item.id)}</code>`,
    );
  }
  if (issues.fontsStale) {
    rows.push("shared/fonts.ts 与清单不一致，运行“生成字体清单”");
  }
  if (requirements.declared) {
    for (const item of requirements.missing) {
      rows.push(`需求缺口 ${esc(item.type)} <code>${esc(item.label)}</code>`);
    }
  }
  if (!rows.length) {
    return `<div class="empty"><strong>没有发现资源问题</strong>缺失、未登记、许可与元数据均已就绪。</div>`;
  }
  return `<ul class="resource-issues">${rows.map((row) => `<li>${row}</li>`).join("")}</ul>`;
}

function resourceRemoveButton(path) {
  return `<button class="btn danger" data-remove-resource="${esc(path)}">移除</button>`;
}

function renderResourceTable() {
  const data = state.resources;
  const container = $("#resourceTable");
  if (!data || !container) return;
  const tab = state.resourceTab;

  if (tab === "manifest" || !["fonts", "music", "sfx"].includes(tab)) {
    const source =
      tab === "manifest"
        ? data.entries
        : data.entries.filter((entry) => entry.kind === tab);
    const list = resourceFilter(
      source,
      ["path", "kind", "license", "source", "family"],
    );
    container.innerHTML = resourceTableHtml(
      ["预览", "路径", "类型", "许可", "来源", "元数据", "大小 / 时间", "操作"],
      list.map((entry) => [
        resourcePreview(entry),
        `<code>${esc(entry.path)}</code>`,
        labelWithHint("resourceKind", entry.kind),
        resourceLicenseBadge(entry.license),
        esc(entry.source ?? "—"),
        entry.family ? esc(`${entry.family} ${entry.weight ?? ""}`) : "—",
        `${fmtBytes(entry.size)} · ${esc(fmtDate(entry.mtime))}`,
        entry.family
          ? `<button class="btn" data-preview-font="${esc(entry.path)}">预览</button> <button class="btn" data-edit-font="${esc(entry.path)}">编辑</button>`
          : "",
        resourceRemoveButton(entry.path),
      ]),
    );
    return;
  }

  if (tab === "fonts") {
    const list = resourceFilter(data.fonts, ["path", "family", "weight", "license", "source"]);
    container.innerHTML = resourceTableHtml(
      ["路径", "family", "weight", "style", "许可", "来源", "大小 / 时间", "操作"],
      list.map((entry) => [
        `<code>${esc(entry.path)}</code>`,
        esc(entry.family ?? "—"),
        esc(entry.weight ?? "—"),
        esc(entry.style ?? "—"),
        resourceLicenseBadge(entry.license),
        esc(entry.source ?? "—"),
        `${fmtBytes(entry.size)} · ${esc(fmtDate(entry.mtime))}`,
        `<button class="btn" data-preview-font="${esc(entry.path)}">预览</button> <button class="btn" data-edit-font="${esc(entry.path)}">编辑</button> ${resourceRemoveButton(entry.path)}`,
      ]),
    );
    return;
  }

  if (tab === "music") {
    const list = resourceFilter(data.music, ["id", "file", "title", "mood", "energy", "license", "source"]);
    container.innerHTML = resourceTableHtml(
      ["试听", "id", "文件", "mood", "energy", "bpm", "许可", "大小 / 时间", "操作"],
      list.map((item) => [
        resourcePreview(item),
        `<code>${esc(item.id)}</code>`,
        `<code>${esc(item.file)}</code>`,
        esc(item.mood ?? "—"),
        esc(item.energy ?? "—"),
        esc(item.bpm ?? "—"),
        resourceLicenseBadge(item.license),
        `${fmtBytes(item.size)} · ${esc(fmtDate(item.mtime))}`,
        `<button class="btn" data-edit-audio="${esc(item.id)}" data-audio-kind="music">编辑</button> ${resourceRemoveButton(item.file)}`,
      ]),
    );
    return;
  }

  const list = resourceFilter(data.sfx, ["id", "file", "category", "license", "source"]);
  container.innerHTML = resourceTableHtml(
    ["试听", "id", "文件", "category", "gain", "许可", "大小 / 时间", "操作"],
    list.map((item) => [
      resourcePreview(item),
      `<code>${esc(item.id)}</code>`,
      `<code>${esc(item.file)}</code>`,
      esc(item.category ?? "—"),
      esc(item.gain ?? "—"),
      resourceLicenseBadge(item.license),
      `${fmtBytes(item.size)} · ${esc(fmtDate(item.mtime))}`,
      `<button class="btn" data-edit-audio="${esc(item.id)}" data-audio-kind="sfx">编辑</button> ${resourceRemoveButton(item.file)}`,
    ]),
  );
}

async function renderResources() {
  await Promise.all([loadResources(true), loadStatus(true), loadMarketProviders()]);
  if (state.resourceMode === "market") {
    await renderResourceMarket();
    return;
  }
  const data = state.resources;
  const issues = data.issues;
  const requirements = data.requirements;
  const missingCount = issues.missing.length + issues.brokenAudio.length;
  const order = Object.keys(state.labels?.groups?.resourceKind ?? {});
  const tabDefs = [
    {
      key: "manifest",
      label: labelOf("resourceTab", "manifest"),
      hint: hintOf("resourceTab", "manifest"),
      count: data.entries.length,
    },
  ];
  for (const kind of Object.keys(data.counts).sort(
    (a, b) =>
      (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) -
        (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) ||
      a.localeCompare(b),
  )) {
    const key = kind === "font" ? "fonts" : kind;
    const group = ["font", "music", "sfx"].includes(kind)
      ? "resourceTab"
      : "resourceKind";
    const labelKey = kind === "font" ? "fonts" : kind;
    tabDefs.push({
      key,
      label: labelOf(group, labelKey),
      hint: hintOf(group, labelKey),
      count: data.counts[kind],
    });
  }
  if (!tabDefs.some((tab) => tab.key === state.resourceTab)) {
    state.resourceTab = "manifest";
  }
  const tabs = tabDefs.map((tab) => [
    tab.key,
    `${tab.label} ${tab.count}`,
    tab.hint,
  ]);

  setActions(`
    <button class="btn" id="resourceRefresh">刷新</button>
    <button class="btn" id="resourceScanAssets">扫描素材</button>
    <button class="btn" id="resourceScanAudio">扫描音频</button>
    <button class="btn" id="resourceFonts">生成字体清单</button>
  `);

  $("#view").innerHTML = `
    ${resourceModeSwitch()}
    <div class="stats">
      ${statCard("已登记素材", data.manifest.entries, "", "assets.manifest.json 中登记的素材条目数（即“全部素材”）")}
      ${statCard("缺失", missingCount)}
      ${statCard("未登记", issues.unregistered.length)}
      ${statCard("许可未知", issues.licenses.unknown.length)}
      ${statCard("音频缺元数据", issues.meta.audio.length)}
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>资源问题</h2>
        <span class="meta">${requirements.declared ? `requirements：${requirements.missing.length} 项缺口` : "未声明 requirements.json"}</span>
      </div>
      ${resourceIssuesHtml(issues, requirements)}
    </div>
    <div class="toolbar">
      <div class="tabs" id="resourceTabs">
        ${tabs.map(([key, label, hint]) => `<button data-resource-tab="${key}"${hint ? ` data-hint="${esc(hint)}"` : ""} class="${state.resourceTab === key ? "active" : ""}">${esc(label)}</button>`).join("")}
      </div>
      <span class="spacer"></span>
      <input class="field search" id="resourceQuery" placeholder="搜索路径 / id / 许可 / 来源" value="${esc(state.resourceQuery)}" />
      <button class="btn primary" id="resourceImportToggle">导入素材</button>
    </div>
    <div class="panel" id="resourceImport" hidden>
      <div class="panel-head"><h2>导入素材</h2><span class="meta">复用 node tools/assets.mjs add</span></div>
      <textarea class="field" id="importPaths" rows="4" placeholder="每行一个文件、目录或 URL"></textarea>
      <div class="form-grid" style="margin-top:10px">
        <div class="form-row">
          <label for="importKeep">整理方式</label>
          <select class="field" id="importKeep">
            <option value="">按扩展名归类</option>
            <option value="keep">保留目录结构（--keep）</option>
          </select>
        </div>
        <div class="form-row">
          <label for="importKind">kind（可选）</label>
          <select class="field" id="importKind">
            <option value="">自动</option>
            <option value="fonts">fonts</option>
            <option value="icons">icons</option>
            <option value="music">music</option>
            <option value="sfx">sfx</option>
            <option value="brand">brand</option>
            <option value="map">map</option>
          </select>
        </div>
        <div class="form-row">
          <label for="importLicense">许可（可选）</label>
          <input class="field" id="importLicense" placeholder="CC0-1.0 / OFL-1.1" />
        </div>
        <div class="form-row">
          <label for="importSource">来源（可选）</label>
          <input class="field" id="importSource" placeholder="来源或作者" />
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="doImport">开始导入</button>
        <span class="faint">导入后在“任务”页查看日志</span>
      </div>
    </div>
    <div id="resourceTable"></div>
  `;

  renderResourceTable();

  $("#resourceRefresh").onclick = () => route();
  $("#resourceScanAssets").onclick = () => runResourceScan("assets", "扫描素材库");
  $("#resourceScanAudio").onclick = () => runResourceScan("audio", "扫描音频");
  $("#resourceFonts").onclick = () => runResourceScan("fonts", "生成字体清单");

  for (const button of document.querySelectorAll("#resourceTabs button")) {
    button.onclick = () => {
      state.resourceTab = button.dataset.resourceTab;
      for (const item of document.querySelectorAll("#resourceTabs button")) {
        item.classList.toggle("active", item === button);
      }
      renderResourceTable();
    };
  }

  $("#resourceQuery").addEventListener("input", (event) => {
    state.resourceQuery = event.target.value;
    renderResourceTable();
  });

  $("#resourceImportToggle").onclick = () => {
    const panel = $("#resourceImport");
    panel.hidden = !panel.hidden;
  };

  $("#doImport").onclick = async () => {
    const paths = $("#importPaths").value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!paths.length) {
      toast("请填写至少一个路径");
      return;
    }
    const keep = $("#importKeep").value === "keep";
    const kind = $("#importKind").value;
    const license = $("#importLicense").value.trim();
    const source = $("#importSource").value.trim();
    try {
      const job = await postJson("/api/resources/import", {
        paths,
        keep,
        kind,
        license,
        source,
      });
      toast(`已提交导入 ${paths.length} 个目标`);
      watchToolJob(job, "导入素材");
    } catch (error) {
      toast(error.message);
    }
  };

  $("#resourceTable").onclick = (event) => {
    const remove = event.target.closest("[data-remove-resource]");
    if (remove) {
      openResourceRemove(remove.dataset.removeResource);
      return;
    }
    const audio = event.target.closest("[data-audio-src]");
    if (audio) {
      openAudioPlayer(audio.dataset.audioSrc, audio.dataset.audioTitle);
      return;
    }
    const previewFont = event.target.closest("[data-preview-font]");
    if (previewFont) {
      openFontPreview(previewFont.dataset.previewFont);
      return;
    }
    const font = event.target.closest("[data-edit-font]");
    if (font) {
      openFontEditor(font.dataset.editFont);
      return;
    }
    const audioEdit = event.target.closest("[data-edit-audio]");
    if (audioEdit) {
      openAudioEditor(audioEdit.dataset.editAudio, audioEdit.dataset.audioKind);
    }
  };

  bindResourceMode();
}

async function runResourceScan(action, message) {
  try {
    const job = await postJson("/api/resources/scan", { action });
    toast(`已提交：${message}`);
    watchToolJob(job, message);
  } catch (error) {
    toast(error.message);
  }
}

function watchToolJob(job, message) {
  if (!job?.id) return;
  const source = new EventSource(`/api/jobs/${encodeURIComponent(job.id)}/stream`);
  source.onmessage = async (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === "exit") {
      source.close();
      toast(`${message}：${payload.status === "done" ? "完成" : "失败，见任务日志"}`);
      if (state.page === "resources") await renderResources();
      else if (state.page === "overview") await renderOverview();
    }
  };
  source.onerror = () => source.close();
}

function fmtClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function openAudioPlayer(src, title) {
  openModal(title || "音频预览", `
    <div class="audio-player">
      <audio id="audioEl" src="${esc(src)}" preload="metadata"></audio>
      <button class="btn primary" id="audioPlay" type="button">播放</button>
      <input class="audio-seek" id="audioSeek" type="range" min="0" max="1000" step="1" value="0" />
      <span class="audio-time" id="audioTime">0:00 / 0:00</span>
    </div>
  `);
  const audio = $("#audioEl");
  const play = $("#audioPlay");
  const seek = $("#audioSeek");
  const time = $("#audioTime");
  const update = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seek.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
    time.textContent = `${fmtClock(current)} / ${fmtClock(duration)}`;
  };
  audio.addEventListener("loadedmetadata", update);
  audio.addEventListener("timeupdate", update);
  audio.addEventListener("ended", () => {
    play.textContent = "播放";
    update();
  });
  seek.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    update();
  });
  play.onclick = () => {
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          play.textContent = "暂停";
        })
        .catch((error) => toast(error.message));
    } else {
      audio.pause();
      play.textContent = "播放";
    }
  };
}

let fontPreviewSeq = 0;

async function openFontPreview(path) {
  const entry = (state.resources?.fonts ?? []).find((item) => item.path === path);
  if (!entry?.media) {
    toast("字体文件不可用");
    return;
  }
  const family = `vp-preview-${++fontPreviewSeq}`;
  openModal(`字体预览 · ${entry.family ?? path}`, `
    <div class="font-preview">
      <div class="font-preview-meta">${esc(entry.family ?? "—")} · weight ${esc(entry.weight ?? "—")} · ${esc(entry.style ?? "normal")} · ${fmtBytes(entry.size)}</div>
      <div class="font-preview-sample" id="fontPreviewSample">春江潮水连海平，海上明月共潮生。<br />The quick brown fox jumps over the lazy dog.<br />ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789<br />！@#￥%……&amp;*（）——+</div>
      <div class="faint" id="fontPreviewStatus">字体加载中…</div>
    </div>
  `);
  try {
    const face = new FontFace(family, `url(${JSON.stringify(entry.media)})`, {
      weight: entry.weight ?? "400",
      style: entry.style ?? "normal",
    });
    document.fonts.add(await face.load());
    const sample = $("#fontPreviewSample");
    if (sample) sample.style.fontFamily = `"${family}", sans-serif`;
    const status = $("#fontPreviewStatus");
    if (status) status.textContent = "预览已加载";
  } catch (error) {
    const status = $("#fontPreviewStatus");
    if (status) status.textContent = `字体加载失败：${error.message}`;
  }
}

function openResourceRemove(path) {
  openModal(`移除资源 · ${path}`, `
    <p>将从清单与音频索引取消登记，并同步 <code>fonts.ts</code> 与 <code>CREDITS.md</code>。</p>
    <div class="kv">
      <div><div class="k">路径</div><div class="v mono">${esc(path)}</div></div>
      <div><div class="k">说明</div><div class="v">删除文件不可恢复；也可以只取消登记，保留磁盘文件。</div></div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn danger" id="removeFile">移除并删除文件</button>
      <button class="btn" id="removeOnly">仅取消登记</button>
      <span class="faint" id="removeStatus"></span>
    </div>
  `);
  const submit = async (keepFile) => {
    const status = $("#removeStatus");
    const fileButton = $("#removeFile");
    const onlyButton = $("#removeOnly");
    fileButton.disabled = true;
    onlyButton.disabled = true;
    status.textContent = "提交中…";
    try {
      const job = await postJson("/api/resources/remove", { path, keepFile });
      closeModal();
      toast(
        keepFile
          ? `已取消登记（文件保留）：${path}`
          : `已移除并删除文件：${path}`,
      );
      watchToolJob(job, "移除资源");
    } catch (error) {
      fileButton.disabled = false;
      onlyButton.disabled = false;
      status.textContent = "";
      toast(error.message);
    }
  };
  $("#removeFile").onclick = () => submit(false);
  $("#removeOnly").onclick = () => submit(true);
}

function openFontEditor(path) {
  const entry = (state.resources?.fonts ?? []).find((item) => item.path === path);
  if (!entry) {
    toast("找不到字体条目");
    return;
  }
  openModal(`编辑字体 · ${path}`, `
    <div class="form-grid">
      <div class="form-row"><label for="fontFamily">family</label><input class="field" id="fontFamily" value="${esc(entry.family ?? "")}" /></div>
      <div class="form-row"><label for="fontWeight">weight</label><input class="field" id="fontWeight" value="${esc(entry.weight ?? "400")}" /></div>
      <div class="form-row"><label for="fontStyle">style</label><input class="field" id="fontStyle" value="${esc(entry.style ?? "")}" placeholder="normal / italic" /></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="saveFont">保存</button></div>
  `);
  $("#saveFont").onclick = async () => {
    try {
      const job = await postJson("/api/resources/meta", {
        type: "font",
        path,
        family: $("#fontFamily").value.trim(),
        weight: $("#fontWeight").value.trim(),
        style: $("#fontStyle").value.trim(),
      });
      closeModal();
      toast("字体元数据已提交");
      watchToolJob(job, "字体元数据");
    } catch (error) {
      toast(error.message);
    }
  };
}

function openAudioEditor(id, kind) {
  const item =
    kind === "music"
      ? (state.resources?.music ?? []).find((entry) => entry.id === id)
      : (state.resources?.sfx ?? []).find((entry) => entry.id === id);
  if (!item) {
    toast("找不到音频条目");
    return;
  }
  const fields =
    kind === "music"
      ? `
        <div class="form-row"><label for="audioMood">mood</label><input class="field" id="audioMood" value="${esc(item.mood ?? "")}" /></div>
        <div class="form-row"><label for="audioEnergy">energy</label><input class="field" id="audioEnergy" value="${esc(item.energy ?? "")}" /></div>
        <div class="form-row"><label for="audioBpm">bpm</label><input class="field" id="audioBpm" value="${esc(item.bpm ?? "")}" /></div>
      `
      : `
        <div class="form-row"><label for="audioCategory">category</label><input class="field" id="audioCategory" value="${esc(item.category ?? "")}" /></div>
        <div class="form-row"><label for="audioGain">gain</label><input class="field" id="audioGain" value="${esc(item.gain ?? "")}" /></div>
      `;
  openModal(`编辑音频 · ${id}`, `
    <div class="form-grid">${fields}</div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="saveAudio">保存</button></div>
  `);
  $("#saveAudio").onclick = async () => {
    const body = { type: "audio", id, audioKind: kind };
    if (kind === "music") {
      body.mood = $("#audioMood").value.trim();
      body.energy = $("#audioEnergy").value.trim();
      body.bpm = $("#audioBpm").value.trim();
    } else {
      body.category = $("#audioCategory").value.trim();
      body.gain = $("#audioGain").value.trim();
    }
    try {
      const job = await postJson("/api/resources/meta", body);
      closeModal();
      toast("音频元数据已提交");
      watchToolJob(job, "音频元数据");
    } catch (error) {
      toast(error.message);
    }
  };
}

/* ------------------------------------------------------------------ modules */

const MODULE_CHECKS = {
  scan: ["scan", ["--check"]],
  quality: ["quality", ["--report-only"]],
  sync: ["sync", ["--check"]],
};

function moduleCardHtml(module) {
  const check = MODULE_CHECKS[module.id];
  const last = module.last;
  return `
    <article class="panel module-card">
      <div class="panel-head">
        <h2>${esc(module.label)}</h2>
        <span class="meta">${last ? `${jobStatusBadge(last.status)} ${esc(fmtDate(last.createdAt))}` : "未运行"}</span>
      </div>
      <p class="module-summary">${esc(module.summary)}</p>
      <p class="faint">${esc(module.detail)}</p>
      <code class="module-command">${esc(module.command)}</code>
      <div class="row" style="margin-top:auto">
        ${check ? `<button class="btn" data-module-check="${esc(module.id)}">运行检查</button>` : ""}
        <a class="btn" href="#/tasks">任务页</a>
      </div>
    </article>`;
}

async function runModuleCheck(id) {
  const entry = MODULE_CHECKS[id];
  if (!entry) return;
  try {
    const [stage, args] = entry;
    const job = await postJson("/api/jobs", { stage, args });
    toast(`已提交检查：${stageLabel(stage)}`);
    watchToolJob(job, `检查 ${stageLabel(stage)}`);
  } catch (error) {
    toast(error.message);
  }
}

/* ------------------------------------------------------------------ assets */

function activeCatalogCount(assets) {
  return assets.filter((asset) => (asset.status ?? "approved") !== "retired").length;
}

function matchesFilters(asset) {
  const filters = state.genFilters;
  const status = asset.status ?? "approved";

  if (filters.status === "active" && status === "retired") return false;
  if (filters.status === "approved" && status !== "approved") return false;
  if (filters.status === "draft" && status !== "draft") return false;
  if (filters.status === "retired" && status !== "retired") return false;

  if (filters.category && asset.category !== filters.category) return false;
  if (filters.layer && asset.layer !== filters.layer) return false;
  if (filters.scope) {
    const scope = asset.scope ?? "shared";
    if (filters.scope === "work" && scope !== "work") return false;
    if (filters.scope === "shared" && scope !== "shared") return false;
  }

  const query = filters.q.trim().toLowerCase();
  if (query) {
    const haystack = [
      asset.id,
      asset.preset,
      asset.series,
      asset.engine,
      asset.creativeId,
      asset.variantId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function assetCardHtml(asset) {
  const status = asset.status ?? "approved";
  const flags = asset.quality?.flags ?? [];
  const thumb = asset.thumb
    ? `<img src="${esc(asset.thumb)}" alt="" loading="lazy" />`
    : `<span class="thumb-empty">无静帧</span>`;
  const corner = [
    status !== "approved" ? `<span class="badge ${status === "draft" ? "warn" : "danger"}">${esc(statusLabel(status))}</span>` : "",
    flags.length ? `<span class="badge warn" title="${esc(flags.map(flagLabel).join("、"))}">${esc(flagLabel(flags[0]))}${flags.length > 1 ? `+${flags.length - 1}` : ""}</span>` : "",
  ].join("");

  return `
    <article class="asset-card" data-asset="${esc(asset.id)}">
      <div class="asset-thumb">
        ${thumb}
        <div class="corner">${corner}</div>
        <span class="dur">${fmtDuration(asset.duration)}</span>
      </div>
      <div class="asset-body">
        <div class="asset-title">${esc(asset.creativeId ? `${asset.creativeId}/${asset.variantId}` : (asset.preset ?? "—"))}</div>
        <div class="asset-sub">
          <span>${labelWithHint("category", asset.category)} · ${labelWithHint("layer", asset.layer)}</span>
          <span>${asset.seriesIndex !== null && asset.seriesIndex !== undefined ? `#${asset.seriesIndex}` : esc(asset.scope ?? "shared")}</span>
        </div>
        <div class="asset-meta">${fmtBytes(asset.size)} · ${esc(fmtDate(asset.mtime))}</div>
      </div>
    </article>`;
}

function renderGeneratedAssets() {
  const assets = (state.catalog ?? []).filter(matchesFilters);
  if (!assets.length) {
    return `<div class="empty"><strong>没有符合条件的生成素材</strong>调整筛选，或运行 generate 生成素材。</div>`;
  }

  if (state.genFilters.group === "series") {
    const groups = new Map();
    for (const asset of assets) {
      const key = asset.series ?? asset.preset ?? "未分组";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(asset);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([series, list]) => {
        list.sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0));
        return `
          <div class="series-head">
            <h3>${esc(series)}</h3>
            <span>${list.length} 个变体</span>
          </div>
          <div class="grid">${list.map(assetCardHtml).join("")}</div>`;
      })
      .join("");
  }

  assets.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return `<div class="grid">${assets.map(assetCardHtml).join("")}</div>`;
}

function footageCardHtml(asset) {
  const thumb = asset.thumbs?.[0]
    ? `<img src="${esc(asset.thumbs[0])}" alt="" loading="lazy" />`
    : `<span class="thumb-empty">无缩略图</span>`;
  return `
    <article class="asset-card" data-footage="${esc(asset.id)}">
      <div class="asset-thumb">
        ${thumb}
        <span class="dur">${fmtDuration(asset.duration)}</span>
      </div>
      <div class="asset-body">
        <div class="asset-title">${esc(asset.name || asset.id)}</div>
        <div class="asset-sub">
          <span>${asset.width}×${asset.height} · ${asset.scenes} 场景</span>
          <span>${esc(asset.status || "")}</span>
        </div>
        <div class="asset-meta">${fmtBytes(asset.size)} · ${esc(fmtDate(asset.mtime))}</div>
      </div>
    </article>`;
}

function renderFootageAssets() {
  const query = state.footageQuery.trim().toLowerCase();
  const assets = (state.library ?? []).filter((asset) => {
    if (!query) return true;
    const haystack = [asset.id, asset.name, asset.relPath].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  if (!assets.length) {
    return `<div class="empty"><strong>没有实拍素材</strong>检查素材根目录后运行 scan。</div>`;
  }
  return `<div class="grid">${assets.map(footageCardHtml).join("")}</div>`;
}

async function renderAssets() {
  await Promise.all([loadCatalog(true), loadLibrary(true), loadStatus(true)]);
  const assets = state.catalog ?? [];
  const categories = [...new Set(assets.map((asset) => asset.category).filter(Boolean))].sort();
  const filters = state.genFilters;

  setActions(`<button class="btn" id="refreshAssets">刷新</button>`);

  $("#view").innerHTML = `
    <div class="toolbar">
      <div class="tabs" id="assetTabs">
        <button data-tab="generated" class="${state.assetTab === "generated" ? "active" : ""}">生成素材 ${assets.length}</button>
        <button data-tab="footage" class="${state.assetTab === "footage" ? "active" : ""}">实拍素材 ${state.library.length}</button>
      </div>
      <span class="spacer"></span>
      ${
        state.assetTab === "generated"
          ? `<select class="field" id="filterStatus">
              <option value="active" ${filters.status === "active" ? "selected" : ""}>活跃（不含退役）</option>
              <option value="approved" ${filters.status === "approved" ? "selected" : ""}>已批准</option>
              <option value="draft" ${filters.status === "draft" ? "selected" : ""}>待审核</option>
              <option value="retired" ${filters.status === "retired" ? "selected" : ""}>已退役</option>
              <option value="all" ${filters.status === "all" ? "selected" : ""}>全部</option>
            </select>`
          : ""
      }
    </div>
    ${
      state.assetTab === "generated"
        ? `<div class="toolbar">
            <select class="field" id="filterCategory">
              <option value="">全部类型</option>
              ${categories.map((category) => `<option value="${esc(category)}" ${filters.category === category ? "selected" : ""}>${esc(categoryLabel(category))}</option>`).join("")}
            </select>
            <select class="field" id="filterLayer">
              <option value="">全部层</option>
              ${Object.entries(state.labels?.groups?.layer ?? {}).map(([value, entry]) => `<option value="${value}" ${filters.layer === value ? "selected" : ""}>${esc(entry.label)}</option>`).join("")}
            </select>
            <select class="field" id="filterScope">
              <option value="">全部范围</option>
              <option value="shared" ${filters.scope === "shared" ? "selected" : ""}>shared</option>
              <option value="work" ${filters.scope === "work" ? "selected" : ""}>work</option>
            </select>
            <select class="field" id="filterGroup">
              <option value="none" ${filters.group === "none" ? "selected" : ""}>不分组</option>
              <option value="series" ${filters.group === "series" ? "selected" : ""}>按系列分组</option>
            </select>
            <input class="field search" id="filterQuery" placeholder="搜索 id / recipe / series" value="${esc(filters.q)}" />
          </div>`
        : `<div class="toolbar">
            <input class="field search" id="footageQuery" placeholder="搜索文件名 / 关键词" value="${esc(state.footageQuery)}" />
          </div>`
    }
    <div id="assetContent">${state.assetTab === "generated" ? renderGeneratedAssets() : renderFootageAssets()}</div>
  `;

  const refresh = $("#refreshAssets");
  if (refresh) refresh.onclick = () => route();

  for (const button of document.querySelectorAll("#assetTabs button")) {
    button.onclick = () => {
      state.assetTab = button.dataset.tab;
      renderAssets();
    };
  }

  const bindFilter = (selector, key, event = "change") => {
    const node = $(selector);
    if (!node) return;
    node.addEventListener(event, () => {
      state.genFilters[key] = node.value;
      $("#assetContent").innerHTML = renderGeneratedAssets();
    });
  };
  bindFilter("#filterStatus", "status");
  bindFilter("#filterCategory", "category");
  bindFilter("#filterLayer", "layer");
  bindFilter("#filterScope", "scope");
  bindFilter("#filterGroup", "group");
  bindFilter("#filterQuery", "q", "input");

  const footageInput = $("#footageQuery");
  if (footageInput) {
    footageInput.addEventListener("input", () => {
      state.footageQuery = footageInput.value;
      $("#assetContent").innerHTML = renderFootageAssets();
    });
  }

  $("#assetContent").onclick = (event) => {
    const card = event.target.closest("[data-asset]");
    if (card) {
      openAssetModal(card.dataset.asset);
      return;
    }
    const footage = event.target.closest("[data-footage]");
    if (footage) openFootageModal(footage.dataset.footage);
  };
}

/* ------------------------------------------------------------------ creative */

const BEAT_ROLES = ["hook", "build", "proof", "turn", "close"];

function creativeCurrent() {
  const data = state.creative.data;
  if (!data) return { project: null, variant: null };
  const project =
    data.projects.find((item) => item.id === state.creative.projectId) ??
    data.projects[0] ??
    null;
  const variant =
    project?.variants.find((item) => item.id === state.creative.variantId) ??
    project?.variants[0] ??
    null;
  return { project, variant };
}

const CREATIVE_ITEM_KEYS = new Set([
  "text",
  "keyword",
  "palette",
  "glitchIndex",
  "count",
  "amount",
  "angle",
  "distanceEm",
  "staggerFrames",
]);

function creativeFieldMaps(project, variant) {
  const shared = project?.engineMeta?.shared ?? {};
  const styleParams = variant?.styleMeta?.params ?? {};
  const variantFields = { ...shared };
  const itemFields = shared.palette ? { palette: shared.palette } : {};
  for (const [key, field] of Object.entries(styleParams)) {
    if (CREATIVE_ITEM_KEYS.has(key)) itemFields[key] = field;
    else variantFields[key] = field;
  }
  return { variantFields, itemFields };
}

function coerceField(field, input) {
  if (!field) return undefined;
  if (field.type === "boolean") return input.checked ? true : undefined;
  const raw = input.value;
  if (raw === "") return undefined;
  if (field.type === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  if (field.type === "stringList") {
    return raw
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (field.type === "numberList") {
    return raw
      .split("\n")
      .map((item) => Number(item.trim()))
      .filter((value) => Number.isFinite(value));
  }
  if (field.type === "enum") {
    const found = (field.values ?? []).find(
      (value) => String(value) === raw,
    );
    return found !== undefined ? found : raw;
  }
  return raw;
}

function creativeFieldHtml(field, key, value, scope) {
  const attrs = `data-scope="${scope}" data-key="${esc(key)}"`;
  if (field.type === "boolean") {
    return `<input type="checkbox" ${attrs} ${value ? "checked" : ""} />`;
  }
  const common = `class="field" ${attrs}`;
  if (field.type === "number") {
    return `<input type="number" ${common} value="${esc(value ?? "")}"
      placeholder="${esc(field.default ?? "")}"
      ${field.min !== undefined ? `min="${field.min}"` : ""}
      ${field.max !== undefined ? `max="${field.max}"` : ""}
      ${field.step !== undefined ? `step="${field.step}"` : ""} />`;
  }
  if (field.type === "enum") {
    return `<select ${common}>
      <option value="">默认${field.default !== undefined ? `（${esc(field.default)}）` : ""}</option>
      ${(field.values ?? [])
        .map(
          (option) =>
            `<option value="${esc(option)}" ${String(value) === String(option) ? "selected" : ""}>${esc(option)}</option>`,
        )
        .join("")}
    </select>`;
  }
  if (field.type === "stringList" || field.type === "numberList") {
    const list = Array.isArray(value) ? value : [];
    const fallback = Array.isArray(field.default) ? field.default.join("\n") : "";
    return `<textarea class="field" rows="${Math.max(2, list.length || 2)}" ${attrs}
      placeholder="${esc(fallback || "每行一个")}">${esc(list.join("\n"))}</textarea>`;
  }
  if (field.multiline) {
    return `<textarea class="field" rows="2" ${attrs}
      placeholder="${esc(field.default ?? "")}">${esc(value ?? "")}</textarea>`;
  }
  return `<input type="text" ${common} value="${esc(value ?? "")}"
    placeholder="${esc(field.default ?? "")}" />`;
}

function creativeFieldRow(key, field, value, scope) {
  return `<div class="form-row creative-field">
    <label>${esc(field.label ?? key)}${field.help ? `<small>${esc(field.help)}</small>` : ""}</label>
    ${creativeFieldHtml(field, key, value, scope)}
  </div>`;
}

function collectCreativeForm(project, variant) {
  const { variantFields, itemFields } = creativeFieldMaps(project, variant);
  const variantParams = { ...(variant.params ?? {}) };
  for (const input of document.querySelectorAll("[data-scope='variant']")) {
    const key = input.dataset.key;
    const value = coerceField(variantFields[key], input);
    if (value === undefined) delete variantParams[key];
    else variantParams[key] = value;
  }

  const originals = new Map(
    (variant.items ?? []).map((item) => [item.id, item]),
  );
  const items = [...document.querySelectorAll("[data-item]")].map((node, index) => {
    const id = node.dataset.itemId || `item-${index + 1}`;
    const original = originals.get(id);
    const params = { ...(original?.params ?? {}) };
    for (const input of node.querySelectorAll("[data-scope='item']")) {
      const key = input.dataset.key;
      const value = coerceField(itemFields[key], input);
      if (value === undefined) delete params[key];
      else params[key] = value;
    }
    return { id, params };
  });

  const beatRoles = [...document.querySelectorAll("[data-role]")]
    .filter((node) => node.checked)
    .map((node) => node.dataset.role);
  const status = $("#creativeStatus")?.value || variant.status || "draft";
  const durationRaw = $("#creativeDuration")?.value;
  const durationFrames = durationRaw ? Number(durationRaw) : undefined;

  return {
    params: variantParams,
    items,
    beatRoles,
    status,
    ...(durationFrames ? { durationFrames } : {}),
  };
}

async function saveCreativeForm() {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return false;
  const draft = collectCreativeForm(project, variant);
  try {
    const result = await postJson(
      `/api/creative/${encodeURIComponent(project.id)}/variant/${encodeURIComponent(variant.id)}`,
      draft,
    );
    if (!result.ok) {
      toast((result.errors ?? ["保存失败"])[0]);
      return false;
    }
    state.creative.dirty = false;
    toast("已保存");
    await renderCreative();
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
}

function watchCreativeJob(job, message) {
  if (!job?.id) return;
  toast(message);
  watchJobOnce(job.id, async () => {
    if (state.page === "creative") await renderCreative();
  });
}

async function creativeSync() {
  const button = $("#creativeSync");
  if (button) button.disabled = true;
  try {
    const job = await postJson("/api/sync", {});
    watchCreativeJob(job, "同步任务已提交");
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function creativeBuild() {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return;
  if (state.creative.dirty) {
    const saved = await saveCreativeForm();
    if (!saved) return;
  }
  releaseVideos();
  try {
    const job = await postJson(`/api/creative/${encodeURIComponent(project.id)}/build`, {
      variant: variant.id,
    });
    watchCreativeJob(job, "构建任务已提交");
  } catch (error) {
    toast(error.message);
  }
}

async function creativePreview() {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return;
  if (state.creative.dirty) {
    const saved = await saveCreativeForm();
    if (!saved) return;
  }
  releaseVideos();
  try {
    const job = await postJson(`/api/creative/${encodeURIComponent(project.id)}/preview`, {
      variant: variant.id,
    });
    watchCreativeJob(job, "预览任务已提交");
  } catch (error) {
    toast(error.message);
  }
}

async function creativeBuildItem(itemId) {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return;
  if (state.creative.dirty) {
    const saved = await saveCreativeForm();
    if (!saved) return;
  }
  releaseVideos();
  try {
    const job = await postJson(`/api/creative/${encodeURIComponent(project.id)}/build`, {
      variant: variant.id,
      item: itemId,
    });
    watchCreativeJob(job, `构建素材 ${itemId}`);
  } catch (error) {
    toast(error.message);
  }
}

async function creativePreviewItem(itemId) {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return;
  if (state.creative.dirty) {
    const saved = await saveCreativeForm();
    if (!saved) return;
  }
  releaseVideos();
  try {
    const job = await postJson(`/api/creative/${encodeURIComponent(project.id)}/preview`, {
      variant: variant.id,
      item: itemId,
    });
    watchCreativeJob(job, `预览素材 ${itemId}`);
  } catch (error) {
    toast(error.message);
  }
}

async function creativeReview(status, assetId = null) {
  const { project, variant } = creativeCurrent();
  if (!project || !variant) return;
  try {
    const job = await postJson(`/api/creative/${encodeURIComponent(project.id)}/review`, {
      variant: variant.id,
      status,
      ...(assetId ? { assetId } : {}),
    });
    watchCreativeJob(job, status === "approved" ? "已提交批准" : "已提交退役");
  } catch (error) {
    toast(error.message);
  }
}

async function renderCreative() {
  const data = await loadCreative(true);
  setActions(
    `<button class="btn" id="creativeRefresh">刷新</button><button class="btn" id="creativeSync">同步内容</button>`,
  );
  const syncButton = $("#creativeSync");
  if (syncButton) syncButton.onclick = creativeSync;

  const projects = data.projects ?? [];
  if (!projects.length) {
    $("#view").innerHTML = `<div class="empty">
      <strong>还没有创意工程</strong>
      在 <span class="mono">creative/</span> 下新建工程，或运行 <span class="mono">node run.mjs creative scan</span>。
    </div>`;
    const button = $("#creativeRefresh");
    if (button) button.onclick = () => route();
    return;
  }

  if (!projects.some((item) => item.id === state.creative.projectId)) {
    state.creative.projectId = projects[0].id;
    state.creative.variantId = projects[0].variants[0]?.id ?? null;
  }
  const project =
    projects.find((item) => item.id === state.creative.projectId) ?? projects[0];
  if (!project.variants.some((item) => item.id === state.creative.variantId)) {
    state.creative.variantId = project.variants[0]?.id ?? null;
  }
  const variant =
    project.variants.find((item) => item.id === state.creative.variantId) ??
    project.variants[0] ??
    null;

  const shared = project.engineMeta?.shared ?? {};
  const { variantFields, itemFields } = creativeFieldMaps(project, variant);
  const variantParams = variant?.params ?? {};
  const effectiveRoles =
    variant?.beatRoles?.length
      ? variant.beatRoles
      : variant?.styleMeta?.beatRoles ?? [];

  const errorBanner = (data.errors ?? []).length
    ? `<div class="panel"><div class="row"><span class="badge danger">校验错误</span><span class="muted">${esc(data.errors[0])}</span></div></div>`
    : "";

  const sync = data.sync;
  const syncParts = [];
  if (sync) {
    syncParts.push(
      sync.registry?.ok
        ? `<span class="badge ok">注册表最新</span>`
        : `<span class="badge warn">${esc(sync.registry?.reason || "注册表状态未知")}</span>`,
    );
    if (sync.assets?.manifest) {
      const diff = sync.assets.added + sync.assets.changed;
      syncParts.push(`<span class="muted">素材 ${sync.assets.entries} 条</span>`);
      syncParts.push(
        diff || sync.assets.missing
          ? `<span class="badge ${diff ? "warn" : "ok"}">新增 ${sync.assets.added} · 变更 ${sync.assets.changed} · 缺失 ${sync.assets.missing}</span>`
          : `<span class="badge ok">素材清单一致</span>`,
      );
    } else {
      syncParts.push(`<span class="muted">无内容包素材清单</span>`);
    }
  }
  const syncBanner = syncParts.length
    ? `<div class="panel"><div class="row">${syncParts.join("")}</div></div>`
    : "";

  const projectList = projects
    .map(
      (item) => `
      <button class="creative-project ${item.id === project.id ? "active" : ""}" data-project="${esc(item.id)}">
        <strong>${esc(item.name)}</strong>
        <small>${esc(item.id)} · v${item.version}</small>
        <span>${item.variants.length} 个变体</span>
      </button>`,
    )
    .join("");

  const variantTabs = project.variants
    .map(
      (item) => `
      <button data-variant="${esc(item.id)}" class="${item.id === variant?.id ? "active" : ""}">
        ${esc(item.name)}${item.status === "draft" ? " · 待审" : item.status === "retired" ? " · 已退役" : ""}
      </button>`,
    )
    .join("");

  if (!variant) {
    $("#view").innerHTML = `<div class="panel"><p class="muted">该工程还没有变体。</p></div>`;
    return;
  }

  const builtVersion = variant.built?.version;
  const stale = builtVersion !== undefined && builtVersion !== variant.version;
  const builtBadge = variant.built
    ? `<span class="badge ${stale ? "warn" : "ok"}">${stale ? "参数已变化" : `已构建 v${builtVersion}`}</span>`
    : `<span class="badge warn">未构建</span>`;

  const assets = variant.assets ?? [];
  const assetRows = assets
    .map(
      (asset) => `
      <tr>
        <td class="mono">${esc(asset.id)}</td>
        <td>${asset.status === "approved" ? `<span class="badge ok">已批准</span>` : asset.status === "retired" ? `<span class="badge danger">已退役</span>` : `<span class="badge warn">待审核</span>`}</td>
        <td class="num">${fmtDuration(asset.duration)}</td>
        <td class="mono">${esc(asset.paramsHash ?? "—")}</td>
        <td>${asset.quality?.ok ? `<span class="badge ok">通过</span>` : `<span class="badge warn">检查中</span>`}${(asset.quality?.flags ?? []).map((flag) => ` <span class="badge warn">${esc(flagLabel(flag))}</span>`).join("")}</td>
        <td class="row">
          ${asset.itemId ? `<button class="btn" data-build-item="${esc(asset.itemId)}">重建</button>` : ""}
          ${asset.itemId ? `<button class="btn" data-preview-item="${esc(asset.itemId)}">预览</button>` : ""}
          ${asset.status !== "approved" ? `<button class="btn" data-asset-status="approved" data-asset-id="${esc(asset.id)}">批准</button>` : ""}
          ${asset.status !== "retired" ? `<button class="btn danger" data-asset-status="retired" data-asset-id="${esc(asset.id)}">退役</button>` : ""}
        </td>
      </tr>`,
    )
    .join("");

  const previewStrip = (variant.previews ?? []).length
    ? `<div class="still-strip">${variant.previews
        .map(
          (src) =>
            `<img src="${esc(src)}" alt="" data-creative-preview="${esc(src)}" loading="lazy" />`,
        )
        .join("")}</div>`
    : "";

  $("#view").innerHTML = `
    ${syncBanner}
    ${errorBanner}
    <div class="creative-layout">
      <aside class="panel creative-side">
        <div class="panel-head"><h2>创意工程</h2><span class="meta">${projects.length}</span></div>
        <div class="creative-projects">${projectList}</div>
      </aside>
      <div class="creative-main">
        <div class="panel">
          <div class="panel-head">
            <h2>${esc(project.name)}</h2>
            <span class="meta">${esc(project.id)} · v${project.version} · ${esc(project.status)}</span>
          </div>
          <div class="row">
            <span class="badge accent">${esc(project.engineMeta?.label ?? project.engine)}</span>
            <span class="badge">${esc(project.engineMeta?.preset ?? "—")}</span>
            <span class="badge">${labelWithHint("layer", project.engineMeta?.layer)}</span>
            ${project.engineMeta?.alpha ? `<span class="badge">透明</span>` : ""}
            ${builtBadge}
            ${state.creative.dirty ? `<span class="badge warn">未保存</span>` : ""}
          </div>
          <p class="muted" style="margin:10px 0 0">${esc(project.intent || "未填写设计意图")}</p>
        </div>

        <div class="panel">
          <div class="panel-head">
            <h2>变体</h2>
            <span class="meta">${variant.file}</span>
          </div>
          <div class="tabs" id="creativeVariants">${variantTabs}</div>

          <div class="form-grid" style="margin-top:16px">
            <div class="form-row">
              <label for="creativeStatus">状态</label>
              <select class="field" id="creativeStatus">
                ${["draft", "approved", "retired"]
                  .map(
                    (value) =>
                      `<option value="${value}" ${variant.status === value ? "selected" : ""}>${esc(statusLabel(value))}</option>`,
                  )
                  .join("")}
              </select>
            </div>
            <div class="form-row">
              <label for="creativeDuration">时长（帧）</label>
              <input class="field" id="creativeDuration" type="number" min="8" max="300"
                value="${esc(variant.durationFrames ?? "")}"
                placeholder="${esc(variant.styleMeta?.durationFrames ?? "")}" />
            </div>
            <div class="form-row">
              <label>叙事角色</label>
              <div class="row">
                ${BEAT_ROLES.map(
                  (role) =>
                    `<label class="creative-role"><input type="checkbox" data-role="${role}" ${effectiveRoles.includes(role) ? "checked" : ""} />${esc(labelOf("beat", role))}</label>`,
                ).join("")}
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>变体参数</h3>
            <div class="form-grid">
              ${Object.entries(variantFields)
                .map(([key, field]) =>
                  creativeFieldRow(key, field, variantParams[key], "variant"),
                )
                .join("")}
            </div>
          </div>

          <div class="detail-section">
            <h3>素材条目（每条产出一条素材）</h3>
            <div id="creativeItems">
              ${(variant.items ?? [])
                .map(
                  (item, index) => `
                  <div class="creative-item" data-item data-item-id="${esc(item.id ?? `item-${index + 1}`)}">
                    <div class="creative-item-head">
                      <strong>素材 ${index + 1}</strong>
                      <span class="faint mono">${esc(item.id ?? `item-${index + 1}`)}</span>
                      <span class="spacer"></span>
                      <button class="btn" data-build-item="${esc(item.id ?? `item-${index + 1}`)}">构建</button>
                      <button class="btn" data-preview-item="${esc(item.id ?? `item-${index + 1}`)}">预览</button>
                      <button class="btn danger" data-remove-item="${index}">移除</button>
                    </div>
                    <div class="form-grid">
                      ${Object.entries(itemFields)
                        .map(([key, field]) =>
                          creativeFieldRow(key, field, item.params?.[key], "item"),
                        )
                        .join("")}
                    </div>
                  </div>`,
                )
                .join("")}
            </div>
            <button class="btn" id="creativeAddItem" style="margin-top:10px">新增素材条目</button>
          </div>

          <div class="row" style="margin-top:16px">
            <button class="btn primary" id="creativeSave">保存</button>
            <button class="btn" id="creativeBuild">保存并构建</button>
            <button class="btn" id="creativePreview">预览静帧</button>
            <span class="spacer"></span>
            <button class="btn" id="creativeApprove">批准该变体全部素材</button>
            <button class="btn danger" id="creativeRetire">退役该变体全部素材</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>产物</h2><span class="meta">${assets.length} 条</span></div>
          ${previewStrip}
          ${
            assets.length
              ? `<div class="table-wrap"><table class="data">
                  <tr><th>素材</th><th>状态</th><th>时长</th><th>params</th><th>质量</th><th>操作</th></tr>
                  ${assetRows}
                </table></div>`
              : `<p class="muted">还没有构建产物；保存后点击“保存并构建”。</p>`
          }
        </div>
      </div>
    </div>
  `;

  const refresh = $("#creativeRefresh");
  if (refresh) refresh.onclick = () => route();

  for (const button of document.querySelectorAll("[data-project]")) {
    button.onclick = () => {
      state.creative.projectId = button.dataset.project;
      state.creative.variantId = null;
      state.creative.dirty = false;
      renderCreative();
    };
  }
  for (const button of document.querySelectorAll("#creativeVariants button")) {
    button.onclick = () => {
      state.creative.variantId = button.dataset.variant;
      state.creative.dirty = false;
      renderCreative();
    };
  }

  $("#view").oninput = () => {
    state.creative.dirty = true;
  };

  $("#creativeSave").onclick = () => saveCreativeForm();
  $("#creativeBuild").onclick = () => creativeBuild();
  $("#creativePreview").onclick = () => creativePreview();
  $("#creativeApprove").onclick = () => creativeReview("approved");
  $("#creativeRetire").onclick = () => creativeReview("retired");

  $("#creativeAddItem").onclick = () => {
    const container = $("#creativeItems");
    const index = container.querySelectorAll("[data-item]").length + 1;
    const node = document.createElement("div");
    node.className = "creative-item";
    node.dataset.item = "";
    node.dataset.itemId = `item-${index}`;
    node.innerHTML = `
      <div class="creative-item-head">
        <strong>素材 ${index}</strong>
        <span class="faint mono">item-${index}</span>
        <span class="spacer"></span>
        <button class="btn" data-build-item="item-${index}">构建</button>
        <button class="btn" data-preview-item="item-${index}">预览</button>
        <button class="btn danger" data-remove-item="${index - 1}">移除</button>
      </div>
      <div class="form-grid">
        ${Object.entries(itemFields)
          .map(([key, field]) => creativeFieldRow(key, field, undefined, "item"))
          .join("")}
      </div>`;
    container.appendChild(node);
    state.creative.dirty = true;
  };

  for (const button of document.querySelectorAll("[data-remove-item]")) {
    button.onclick = () => {
      const node = button.closest("[data-item]");
      if (document.querySelectorAll("[data-item]").length <= 1) {
        toast("至少保留一条素材");
        return;
      }
      node?.remove();
      state.creative.dirty = true;
    };
  }

  for (const button of document.querySelectorAll("[data-asset-status]")) {
    button.onclick = () =>
      creativeReview(button.dataset.assetStatus, button.dataset.assetId);
  }

  for (const button of document.querySelectorAll("[data-build-item]")) {
    button.onclick = () => creativeBuildItem(button.dataset.buildItem);
  }
  for (const button of document.querySelectorAll("[data-preview-item]")) {
    button.onclick = () => creativePreviewItem(button.dataset.previewItem);
  }

  for (const thumb of document.querySelectorAll("[data-creative-preview]")) {
    thumb.onclick = () => {
      openModal(`${project.id} / ${variant.id}`, `<div class="preview-box"><img src="${esc(thumb.dataset.creativePreview)}" alt="" /></div>`);
    };
  }
}

/* ------------------------------------------------------------------ asset modal */

function openAssetModal(id) {
  const asset = (state.catalog ?? []).find((item) => item.id === id);
  if (!asset) return;
  const status = asset.status ?? "approved";
  const quality = asset.quality;
  const flags = quality?.flags ?? [];

  const preview = asset.mp4
    ? `<div class="preview-box">
         <video src="${esc(asset.mp4)}" poster="${esc(asset.thumb ?? "")}" controls preload="none" playsinline></video>
       </div>`
    : `<div class="preview-box">${asset.thumb ? `<img src="${esc(asset.thumb)}" alt="" />` : "无预览"}</div>`;

  const stillStrip = (asset.stills ?? []).length
    ? `<div class="still-strip">${asset.stills
        .map((src) => `<img src="${esc(src)}" alt="" data-still="${esc(src)}" loading="lazy" />`)
        .join("")}</div>`
    : "";

  const metrics = quality
    ? `<div class="kv">
        <div><div class="k">质量</div><div class="v">${quality.ok ? "通过" : "未通过"}</div></div>
        <div><div class="k">标记</div><div class="v">${flags.length ? esc(flags.map(flagLabel).join("、")) : "—"}</div></div>
        <div><div class="k"${qhint("alphaCoverage")}>透明覆盖${qmark("alphaCoverage")}</div><div class="v">${fmtPercent(quality.alphaCoverage)}</div></div>
        <div><div class="k"${qhint("motionEnergy")}>运动能量${qmark("motionEnergy")}</div><div class="v">${fmtNum(quality.motionEnergy, 5)}</div></div>
        <div><div class="k"${qhint("brightness")}>亮度 / 对比${qmark("brightness")}</div><div class="v">${fmtNum(quality.brightness)} / ${fmtNum(quality.contrast)}</div></div>
        <div><div class="k"${qhint("firstLastHamming")}>首尾 Hamming${qmark("firstLastHamming")}</div><div class="v">${fmtNum(quality.firstLastHamming)}</div></div>
        <div><div class="k"${qhint("endMotion")}>末帧运动${qmark("endMotion")}</div><div class="v">${fmtNum(quality.endMotion, 5)}</div></div>
        <div><div class="k"${qhint("alphaEnd")}>末帧透明${qmark("alphaEnd")}</div><div class="v">${fmtPercent(quality.alphaEnd)}</div></div>
      </div>`
    : `<p class="muted">还没有质量数据，运行 <span class="mono">quality</span> 后生成。</p>`;

  const variation =
    asset.variation && typeof asset.variation === "object"
      ? `<div class="detail-section">
          <h3>变化轴</h3>
          <div class="kv">
            ${Object.entries(asset.variation)
              .filter(([, value]) => value !== null && typeof value !== "object")
              .map(([key, value]) => `<div><div class="k">${esc(key)}</div><div class="v">${esc(value)}</div></div>`)
              .join("") || `<span class="faint">—</span>`}
          </div>
        </div>`
      : "";

  const tags = asset.tags && Object.keys(asset.tags).length
    ? `<div class="detail-section">
        <h3>标签</h3>
        <div class="row">${Object.entries(asset.tags)
          .map(([key, value]) => `<span class="chip">${esc(key)}=${esc(value)}</span>`)
          .join("")}</div>
      </div>`
    : "";

  const actions = [
    status !== "approved" ? `<button class="btn primary" data-action="approve">批准</button>` : "",
    status !== "retired" ? `<button class="btn danger" data-action="reject">退役</button>` : "",
    (asset.scope ?? "shared") === "work" ? `<button class="btn" data-action="share">提升为 shared</button>` : "",
    (asset.scope ?? "shared") === "work" ? `<button class="btn danger" data-action="clean-work">清理 work（dry-run）</button>` : "",
  ]
    .filter(Boolean)
    .join("");

  openModal(
    asset.id,
    `<div class="asset-detail">
      <div>
        ${preview}
        ${stillStrip}
      </div>
      <div>
        <div class="row">
          ${statusBadge(status)}
          <span class="badge accent">${labelWithHint("category", asset.category)}</span>
          <span class="badge">${labelWithHint("layer", asset.layer)}</span>
          <span class="badge">${esc(asset.scope ?? "shared")}</span>
          ${asset.alpha ? `<span class="badge">透明</span>` : ""}
          ${asset.loop ? `<span class="badge">循环</span>` : ""}
        </div>
        <div class="kv">
          <div><div class="k">来源</div><div class="v">${esc(asset.creativeId ? `${asset.creativeId}/${asset.variantId}` : (asset.preset ?? "—"))}</div></div>
          <div><div class="k">engine</div><div class="v">${esc(asset.engine ?? "—")}</div></div>
          <div><div class="k">时长</div><div class="v">${fmtDuration(asset.duration)}</div></div>
          <div><div class="k">大小</div><div class="v">${fmtBytes(asset.size)}</div></div>
          <div><div class="k">修改时间</div><div class="v">${esc(fmtDate(asset.mtime))}</div></div>
          <div><div class="k">系列</div><div class="v">${esc(asset.series ?? "—")}${asset.seriesIndex !== null && asset.seriesIndex !== undefined ? ` #${asset.seriesIndex}` : ""}</div></div>
          ${asset.creativeId ? `<div><div class="k">风格</div><div class="v">${esc(asset.style ?? "—")}</div></div>` : ""}
          ${asset.creativeId ? `<div><div class="k">创意版本</div><div class="v">v${esc(asset.creativeVersion ?? "?")} · 变体 v${esc(asset.variantVersion ?? "?")}</div></div>` : ""}
          ${asset.creativeId ? `<div><div class="k">params hash</div><div class="v">${esc(asset.paramsHash ?? "—")}</div></div>` : ""}
        </div>
        <div class="detail-section">
          <h3>质量指标</h3>
          ${metrics}
        </div>
        ${variation}
        ${tags}
        ${actions ? `<div class="detail-actions">${actions}</div>` : ""}
      </div>
    </div>`,
  );

  for (const still of document.querySelectorAll("#modalBody [data-still]")) {
    still.onclick = () => {
      const video = $("#modalBody .preview-box video");
      if (video) {
        video.setAttribute("poster", still.dataset.still);
        return;
      }
      const image = $("#modalBody .preview-box img");
      if (image) image.src = still.dataset.still;
    };
  }

  for (const button of document.querySelectorAll("#modalBody [data-action]")) {
    button.onclick = () => runAssetAction(button.dataset.action, asset.id);
  }
}

function openFootageModal(id) {
  const asset = (state.library ?? []).find((item) => item.id === id);
  if (!asset) return;
  const thumbs = asset.thumbs ?? [];

  openModal(
    asset.name || asset.id,
    `<div class="asset-detail">
      <div>
        <div class="preview-box">
          <video src="/media/footage/${encodeURIComponent(asset.id)}" poster="${esc(thumbs[0] ?? "")}" controls preload="metadata" playsinline></video>
        </div>
        <div class="still-strip">
          ${thumbs.map((src) => `<img src="${esc(src)}" alt="" data-thumb="${esc(src)}" loading="lazy" />`).join("")}
        </div>
      </div>
      <div>
        <div class="row">
          <span class="badge ${asset.status === "active" ? "ok" : "warn"}">${esc(asset.status === "active" ? "活跃" : asset.status ?? "—")}</span>
          <span class="badge">${esc(asset.type ?? "video")}</span>
          <span class="badge">${asset.scenes} 个场景</span>
        </div>
        <div class="kv">
          <div><div class="k">时长</div><div class="v">${fmtDuration(asset.duration)}</div></div>
          <div><div class="k">大小</div><div class="v">${fmtBytes(asset.size)}</div></div>
          <div><div class="k">修改时间</div><div class="v">${esc(fmtDate(asset.mtime))}</div></div>
          <div><div class="k">分辨率</div><div class="v">${asset.width}×${asset.height}</div></div>
          <div><div class="k">文件</div><div class="v">${esc(asset.path ?? "—")}</div></div>
        </div>
      </div>
    </div>`,
  );

  for (const thumb of document.querySelectorAll("#modalBody [data-thumb]")) {
    thumb.onclick = () => {
      const video = $("#modalBody video");
      if (video) video.poster = thumb.dataset.thumb;
    };
  }
}

async function runAssetAction(action, id) {
  releaseVideos();
  closeModal();
  try {
    const job = await postJson("/api/action", { action, id });
    toast(`已提交：${labelOf("action", action)} ${id}`);
    watchJobOnce(job.id, async () => {
      await Promise.all([loadCatalog(true), loadStatus(true)]);
      if (state.page === "assets") await renderAssets();
    });
  } catch (error) {
    toast(error.message);
  }
}

/* ------------------------------------------------------------------ tasks */

function configDefaults(stage) {
  const config = state.config;
  if (!config) return {};
  const defaults = {};
  if (stage === "mix") {
    defaults.duration = config.mix.duration;
    defaults.outputs = config.mix.outputs;
    defaults.seed = config.mix.seed;
    defaults.shotLength = `${config.mix.shotLength.min}–${config.mix.shotLength.max}`;
  }
  if (stage === "fission") {
    defaults.works = config.fission.works;
    defaults.duration = config.fission.duration;
  }
  if (stage === "scan") defaults.limit = null;
  return defaults;
}

function stageHint(stage) {
  const config = state.config;
  if (!config) return "";
  if (stage === "mix") {
    return `当前配置：${config.mix.duration} 秒 / ${config.mix.outputs} 条 / seed ${config.mix.seed} / 镜头 ${config.mix.shotLength.min}–${config.mix.shotLength.max} 秒`;
  }
  if (stage === "fission") {
    return config.fission.generateAssets ? "默认生成作品专属素材" : "默认只用 shared 素材库";
  }
  if (stage === "scan") {
    return `素材根：${(config.footage.roots ?? []).join("、")}`;
  }
  return "";
}

function taskValues(stage) {
  if (!state.taskValues[stage]) state.taskValues[stage] = {};
  return state.taskValues[stage];
}

function buildArgs(stage, values) {
  const fields = state.parameters?.stages?.[stage]?.fields ?? [];
  const args = [];
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === "checkbox") {
      if (value) args.push(`--${field.flag}`);
    } else if (value !== undefined && value !== null && String(value) !== "") {
      args.push(`--${field.flag}`, String(value));
    }
  }
  return args;
}

function commandPreview(stage, values) {
  return `node run.mjs ${stage} ${buildArgs(stage, values).join(" ")}`.trim();
}

function paintTaskForm() {
  const stage = state.taskStage;
  const definition = state.parameters?.stages?.[stage];
  const values = taskValues(stage);
  const defaults = configDefaults(stage);
  const form = $("#taskForm");
  if (!form || !definition) return;

  form.innerHTML = definition.fields.length
    ? definition.fields
        .map((field) => {
          const id = `field-${field.name}`;
          const hint = field.hint ? esc(field.hint) : "";
          const hintAttr = hint ? ` data-hint="${hint}"` : "";
          const hintDot = hint ? `<span class="hint-dot" data-hint="${hint}">?</span>` : "";
          if (field.type === "checkbox") {
            return `<div class="form-row">
              <label for="${id}"${hintAttr}>${esc(field.label)}${hintDot}</label>
              <input type="checkbox" id="${id}" data-field="${esc(field.name)}" data-type="checkbox"${hintAttr} ${values[field.name] ? "checked" : ""} />
            </div>`;
          }
          const type = field.type === "number" ? "number" : "text";
          const placeholder = defaults[field.name] ?? field.placeholder ?? "";
          return `<div class="form-row">
            <label for="${id}"${hintAttr}>${esc(field.label)}${hintDot}</label>
            <input class="field" type="${type}" id="${id}" data-field="${esc(field.name)}" data-type="${type}"${hintAttr}
              placeholder="${esc(placeholder)}" value="${esc(values[field.name] ?? "")}" />
          </div>`;
        })
        .join("")
    : `<p class="muted">该阶段没有参数，直接运行即可。</p>`;

  for (const input of form.querySelectorAll("[data-field]")) {
    const handler = () => {
      const key = input.dataset.field;
      if (input.dataset.type === "checkbox") values[key] = input.checked;
      else values[key] = input.value;
      updatePreview();
    };
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  }

  const hint = $("#taskHint");
  if (hint) {
    hint.textContent = stageHint(stage);
    hint.title = stageHint(stage);
  }
  updatePreview();
}

function updatePreview() {
  const preview = $("#cmdPreview");
  if (preview) preview.textContent = commandPreview(state.taskStage, taskValues(state.taskStage));
}

function jobHeadText(job) {
  if (!job) return "";
  const args = job.args?.join(" ") ?? "";
  return `${jobStatusBadge(job.status)} <span class="mono">${esc(stageLabel(job.stage))} ${esc(args)}</span>`;
}

function updateJobHead(job) {
  const head = $("#jobHead");
  if (head) head.innerHTML = jobHeadText(job);
  const cancel = $("#cancelJob");
  if (cancel) cancel.hidden = !(job && (job.status === "running" || job.status === "queued"));
}

function renderJobsList() {
  const container = $("#jobsList");
  if (!container) return;
  const jobs = state.jobs?.jobs ?? [];
  const meta = $("#jobsMeta");
  if (meta) meta.textContent = `${jobs.length} 条`;
  if (!jobs.length) {
    container.innerHTML = `<p class="muted">还没有任务。</p>`;
    return;
  }
  container.innerHTML = jobs
    .map(
      (job) => `
    <div class="job-item ${state.selectedJob === job.id ? "selected" : ""}" data-job="${esc(job.id)}">
      <span class="stage">${esc(job.stage)}</span>
      <span class="args">${esc(job.args.join(" ")) || "无参数"}</span>
      <span class="when">${jobStatusBadge(job.status)} <span class="faint">${esc(fmtDate(job.createdAt))}</span></span>
    </div>`,
    )
    .join("");

  for (const item of container.querySelectorAll("[data-job]")) {
    item.onclick = () => {
      openJobLog(item.dataset.job, false);
      renderJobsList();
    };
  }
}

async function renderTasks() {
  await Promise.all([loadParameters(), loadConfig(), loadJobs(true), loadStatus(true)]);

  const stages = Object.entries(state.parameters.stages);
  if (!stages.some(([key]) => key === state.taskStage)) state.taskStage = stages[0]?.[0] ?? "mix";

  setActions(`<button class="btn" id="refreshJobs">刷新</button>`);

  $("#view").innerHTML = `
    <div class="task-layout">
      <div class="panel">
        <div class="panel-head"><h2>提交任务</h2><span class="meta">单任务队列</span></div>
        <div class="form-grid">
          <div class="form-row">
            <label for="taskStage">阶段</label>
            <select class="field" id="taskStage">
              ${stages
                .map(([key, definition]) => `<option value="${esc(key)}" ${key === state.taskStage ? "selected" : ""}>${esc(definition.label ?? stageLabel(key))}</option>`)
                .join("")}
            </select>
          </div>
          <div id="taskForm"></div>
        </div>
        <div class="cmd-preview" id="cmdPreview"></div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="runTask">运行</button>
          <span class="faint" id="taskHint"></span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>运行日志</h2><span class="meta" id="jobHead"></span></div>
        <pre class="log" id="jobLog">选择任务查看日志</pre>
        <div class="row" style="margin-top:10px">
          <button class="btn danger" id="cancelJob" hidden>取消任务</button>
        </div>
        <div class="panel-head" style="margin-top:18px"><h2>最近任务</h2><span class="meta" id="jobsMeta"></span></div>
        <div class="job-list" id="jobsList"></div>
      </div>
    </div>
  `;

  $("#taskStage").onchange = (event) => {
    state.taskStage = event.target.value;
    paintTaskForm();
  };

  paintTaskForm();
  renderJobsList();

  $("#runTask").onclick = async () => {
    const stage = state.taskStage;
    const args = buildArgs(stage, taskValues(stage));
    releaseVideos();
    try {
      const job = await postJson("/api/jobs", { stage, args });
      state.selectedJob = job.id;
      toast(`已提交：${stageLabel(stage)}`);
      await loadJobs(true);
      renderJobsList();
      openJobLog(job.id, true);
    } catch (error) {
      toast(error.message);
    }
  };

  $("#cancelJob").onclick = async () => {
    if (!state.selectedJob) return;
    try {
      const result = await postJson(`/api/jobs/${encodeURIComponent(state.selectedJob)}/cancel`, {});
      toast(result.ok ? "已请求取消" : "无法取消");
      closeEventSource();
      await loadJobs(true);
      renderJobsList();
    } catch (error) {
      toast(error.message);
    }
  };

  const refresh = $("#refreshJobs");
  if (refresh) refresh.onclick = () => route();

  const jobs = state.jobs?.jobs ?? [];
  const preferred = state.selectedJob ?? jobs.find((job) => job.status === "running")?.id ?? jobs[0]?.id;
  if (preferred) openJobLog(preferred, false);

  clearInterval(state.timers.jobs);
  state.timers.jobs = setInterval(async () => {
    if (document.hidden || state.page !== "tasks") return;
    try {
      await loadJobs(true);
      renderJobsList();
      const selected = (state.jobs?.jobs ?? []).find((job) => job.id === state.selectedJob);
      if (selected) updateJobHead(selected);
    } catch {
      /* ignore */
    }
  }, 3000);
}

/* ------------------------------------------------------------------ job log */

function closeEventSource() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function openJobLog(jobId, notify) {
  state.selectedJob = jobId;
  const log = $("#jobLog");
  if (!log) return;
  log.textContent = "";
  closeEventSource();

  const known = (state.jobs?.jobs ?? []).find((job) => job.id === jobId);
  const live = known ? ["running", "queued"].includes(known.status) : true;
  if (known) updateJobHead(known);

  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`);
  state.eventSource = source;

  source.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "log") {
      const box = $("#jobLog");
      if (!box) return;
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 48;
      box.textContent += message.chunk;
      if (atBottom) box.scrollTop = box.scrollHeight;
      return;
    }
    if (message.type === "status") {
      updateJobHead(message.job);
      return;
    }
    if (message.type === "exit") {
      source.close();
      if (state.eventSource === source) state.eventSource = null;
      loadJobs(true).then(renderJobsList).catch(() => {});
      if (notify && live) {
        toast(`任务${message.code === 0 ? "完成" : "失败"}（退出码 ${message.code}）`);
      }
      if (state.page === "tasks") {
        Promise.all([loadCatalog(true), loadStatus(true)]).catch(() => {});
      }
    }
  };
}

function watchJobOnce(jobId, onExit) {
  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`);
  source.onmessage = (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "exit") {
      source.close();
      Promise.resolve(onExit?.(message.code)).catch(() => {});
    }
  };
}

/* ------------------------------------------------------------------ outputs */

async function renderOutputs() {
  const outputs = await loadOutputs(true);
  setActions(`<button class="btn" id="refreshOutputs">刷新</button>`);

  if (!outputs.length) {
    $("#view").innerHTML = `<div class="empty">
      <strong>还没有成片</strong>
      规划并渲染一条成片后，这里会显示时间线摘要与播放器。
      <code>node run.mjs mix --duration 15 --outputs 1 --seed 20261108</code>
    </div>`;
  } else {
    $("#view").innerHTML = `<div class="job-list">
      ${outputs
        .map(
          (output) => `
        <article class="output-card" data-output="${esc(output.id)}">
          <div class="output-poster">
            ${output.poster ? `<img src="${esc(output.poster)}" alt="" loading="lazy" />` : `<span>无静帧</span>`}
          </div>
          <div class="output-body">
            <h3>${esc(output.id)}</h3>
            <div class="row">
              <span class="badge accent">${fmtDuration(output.duration)}</span>
              <span class="badge">${output.shots} 镜头</span>
              <span class="badge">实拍 ${output.footage}</span>
              <span class="badge">生成 ${output.generated}</span>
              <span class="badge">${fmtBytes(output.size)}</span>
              ${output.workProfile ? `<span class="badge warn">${esc(output.workProfile)}</span>` : ""}
            </div>
            <div class="faint mono">${esc(fmtDate(output.mtime))}</div>
            <div class="output-actions">
              <button class="btn" data-play="${esc(output.id)}">播放</button>
              <button class="btn" data-reveal="${esc(output.id)}">打开所在文件夹</button>
              <button class="btn" data-copy="${esc(output.id)}">复制路径</button>
            </div>
          </div>
        </article>`,
        )
        .join("")}
    </div>`;
  }

  const refresh = $("#refreshOutputs");
  if (refresh) refresh.onclick = () => route();

  const byId = new Map(outputs.map((output) => [output.id, output]));
  const view = $("#view");

  view.onclick = (event) => {
    const play = event.target.closest("[data-play]");
    if (play) {
      openOutputModal(byId.get(play.dataset.play));
      return;
    }
    const reveal = event.target.closest("[data-reveal]");
    if (reveal) {
      const output = byId.get(reveal.dataset.reveal);
      postJson("/api/reveal", { path: output.file })
        .then(() => toast("已在文件管理器中定位"))
        .catch((error) => toast(error.message));
      return;
    }
    const copy = event.target.closest("[data-copy]");
    if (copy) {
      const output = byId.get(copy.dataset.copy);
      navigator.clipboard
        ?.writeText(output.file)
        .then(() => toast("路径已复制"))
        .catch(() => toast(output.file));
      return;
    }
    const card = event.target.closest("[data-output]");
    if (card) openOutputModal(byId.get(card.dataset.output));
  };
}

function openOutputModal(output) {
  if (!output) return;
  openModal(
    output.id,
    `<div class="asset-detail">
      <div class="preview-box">
        <video src="${esc(output.url)}" poster="${esc(output.poster ?? "")}" controls preload="none" playsinline></video>
      </div>
      <div>
        <div class="row">
          <span class="badge accent">${fmtDuration(output.duration)}</span>
          <span class="badge">${output.shots} 镜头</span>
          <span class="badge">实拍 ${output.footage}</span>
          <span class="badge">生成 ${output.generated}</span>
          <span class="badge">${fmtBytes(output.size)}</span>
        </div>
        <div class="kv">
          <div><div class="k">渲染时间</div><div class="v">${esc(fmtDate(output.mtime))}</div></div>
          <div><div class="k">works profile</div><div class="v">${esc(output.workProfile ?? "—")}</div></div>
          <div><div class="k">文件</div><div class="v">${esc(output.file)}</div></div>
        </div>
        <div class="detail-actions">
          <button class="btn" id="revealOutput">打开所在文件夹</button>
          <button class="btn" id="copyOutput">复制路径</button>
        </div>
      </div>
    </div>`,
  );

  $("#revealOutput").onclick = () =>
    postJson("/api/reveal", { path: output.file })
      .then(() => toast("已在文件管理器中定位"))
      .catch((error) => toast(error.message));
  $("#copyOutput").onclick = () =>
    navigator.clipboard
      ?.writeText(output.file)
      .then(() => toast("路径已复制"))
      .catch(() => toast(output.file));
}

/* ------------------------------------------------------------------ quality */

async function renderQuality() {
  const [report, catalog] = await Promise.all([loadQuality(true), loadCatalog(true)]);
  setActions(`<button class="btn" id="refreshQuality">刷新</button>`);

  if (!report) {
    $("#view").innerHTML = `<div class="empty"><strong>还没有质量报告</strong>运行质量分析后生成报告。<code>node run.mjs quality</code></div>`;
    const button = $("#refreshQuality");
    if (button) button.onclick = () => route();
    return;
  }

  const summary = report.summary ?? {};
  const stale = report.catalogCount !== undefined && report.catalogCount !== activeCatalogCount(catalog);

  const layers = Object.entries(report.layers ?? {});
  const layerRows = layers
    .map(
      ([layer, data]) => `
      <tr>
        <td>${labelWithHint("layer", layer)}</td>
        <td class="num">${data.assets ?? "—"}</td>
        <td class="num">${data.clusters ?? "—"}</td>
        <td class="num">${fmtNum(data.diversity, 3)}</td>
        <td class="num">${fmtNum(data.avgMotionEnergy, 4)}</td>
        <td class="num">${fmtPercent(data.avgAlphaCoverage)}</td>
        <td class="num">${data.flagged ?? 0}</td>
      </tr>`,
    )
    .join("");

  const axes = Object.entries(report.axes ?? {})
    .filter(([, axis]) => (axis.values ?? []).some((value) => value.value !== "n/a"))
    .map(([key, axis]) => {
      const max = Math.max(...axis.values.map((value) => value.count), 1);
      return `
        <div class="axis-block">
          <div class="panel-head">
            <h2>${esc(axis.label ?? key)}</h2>
            <span class="meta">${axis.distinct} 种 · 归一化 ${fmtNum(axis.normalized, 3)}</span>
          </div>
          <div class="bars">
            ${axis.values
              .map(
                (value) => `
              <div class="bar-row">
                <span class="mono">${esc(value.value)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.round((value.count / max) * 100))}%"></div></div>
                <span class="bar-value">${value.count} · ${value.clusters ?? 0} 簇</span>
              </div>`,
              )
              .join("")}
          </div>
        </div>`;
    })
    .join("");

  const matrices = Object.entries(report.matrices ?? {})
    .map(([key, matrix]) => {
      const head = `<tr><th>${esc(labelOf("matrix", key))}</th>${matrix.cols.map((col) => `<th>${esc(col)}</th>`).join("")}</tr>`;
      const rows = matrix.rows
        .map(
          (row) => `<tr><td>${esc(row)}</td>${matrix.cols
            .map((col) => {
              const value = matrix.cells?.[row]?.[col] ?? 0;
              return `<td class="cell ${value ? "" : "empty-cell"}">${value}</td>`;
            })
            .join("")}</tr>`,
        )
        .join("");
      return `
        <div class="panel">
          <div class="panel-head">
            <h2>${esc(labelOf("matrix", key))}</h2>
            <span class="meta">覆盖 ${matrix.filled}/${matrix.total} · ${fmtPercent(matrix.coverage)}</span>
          </div>
          <div class="table-wrap"><table class="data matrix">${head}${rows}</table></div>
        </div>`;
    })
    .join("");

  const flagged = (report.flagged ?? []).map(
    (item) => `
      <tr>
        <td class="mono">${esc(item.id)}</td>
        <td>${labelWithHint("layer", item.layer)}</td>
        <td>${esc(categoryLabel(item.category))}</td>
        <td>${(item.flags ?? []).map((flag) => `<span class="badge warn">${esc(flagLabel(flag))}</span>`).join(" ") || "—"}</td>
        <td class="num">${fmtPercent(item.alphaCoverage)}</td>
        <td class="num">${fmtNum(item.motionEnergy, 5)}</td>
      </tr>`,
  );

  const clusters = (report.clusters ?? [])
    .map(
      (cluster) => `
      <div class="cluster">
        <div class="cluster-head">
          <strong>${esc(cluster.id)}</strong>
          <span>${labelWithHint("layer", cluster.layer)} · ${cluster.size} 条</span>
        </div>
        <div class="row">${(cluster.members ?? []).map((member) => `<span class="chip">${esc(member)}</span>`).join("")}</div>
      </div>`,
    )
    .join("");

  const duplicates = (report.nearDuplicates ?? [])
    .map(
      (pair) => `
      <tr>
        <td class="mono">${esc(pair.a)}</td>
        <td class="mono">${esc(pair.b)}</td>
        <td>${labelWithHint("layer", pair.layer)}</td>
        <td class="num">${fmtNum(pair.score, 3)}</td>
        <td class="num">${fmtNum(pair.hammingMin)} / ${fmtNum(pair.hammingMean)}</td>
        <td class="num">${fmtNum(pair.colorDistance, 1)}</td>
      </tr>`,
    )
    .join("");

  $("#view").innerHTML = `
    ${
      stale
        ? `<div class="panel"><div class="row"><span class="badge warn">报告待更新</span><span class="muted">报告覆盖 ${report.catalogCount ?? "?"} 条活跃素材，当前 ${activeCatalogCount(catalog)} 条。运行 quality 重新分析。</span></div></div>`
        : ""
    }
    <div class="stats">
      <div class="stat"><div class="label"${qhint("analyzed")}>已分析${qmark("analyzed")}</div><div class="value">${summary.analyzed ?? "—"}</div><div class="hint">共 ${summary.assets ?? "—"} 条 · 缺失 ${summary.missing ?? 0}</div></div>
      <div class="stat"><div class="label"${qhint("clusters")}>感知簇${qmark("clusters")}</div><div class="value">${summary.clusters ?? "—"}</div><div class="hint">多样性 ${fmtNum(summary.diversity, 3)}</div></div>
      <div class="stat"><div class="label"${qhint("nearDuplicates")}>近似重复${qmark("nearDuplicates")}</div><div class="value">${summary.nearDuplicates ?? "—"}</div><div class="hint">展示 ${(report.nearDuplicates ?? []).length} 对</div></div>
      <div class="stat"><div class="label"${qhint("warnings")}>警告 / 失败${qmark("warnings")}</div><div class="value">${summary.warnings ?? 0} / ${summary.flagged ?? 0}</div><div class="hint">报告 ${esc(fmtDate(report.generatedAt))}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>分层概览</h2><span class="meta">报告版本 ${esc(report.version ?? "—")}</span></div>
      <div class="table-wrap">
        <table class="data">
          <tr><th>层</th><th>素材</th><th>簇</th><th${qhint("diversity")}>多样性${qmark("diversity")}</th><th${qhint("motionEnergy")}>运动能量${qmark("motionEnergy")}</th><th${qhint("alphaCoverage")}>透明覆盖${qmark("alphaCoverage")}</th><th>警告</th></tr>
          ${layerRows}
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>质量标记</h2><span class="meta">${flagged.length} 条</span></div>
      ${
        flagged.length
          ? `<div class="table-wrap"><table class="data">
              <tr><th>素材</th><th>层</th><th>类型</th><th>标记</th><th${qhint("alphaCoverage")}>透明覆盖${qmark("alphaCoverage")}</th><th${qhint("motionEnergy")}>运动能量${qmark("motionEnergy")}</th></tr>
              ${flagged.join("")}
            </table></div>`
          : `<p class="muted">没有质量标记。</p>`
      }
    </div>

    <div class="panel">
      <div class="panel-head"><h2>近似重复</h2><span class="meta">阈值 ${fmtNum(report.summary?.options?.similarityThreshold, 2)} · 共 ${report.nearDuplicateTotal ?? 0} 对</span></div>
      ${
        duplicates
          ? `<div class="table-wrap"><table class="data">
              <tr><th>A</th><th>B</th><th>层</th><th${qhint("score")}>score${qmark("score")}</th><th${qhint("hamming")}>Hamming min/mean${qmark("hamming")}</th><th${qhint("colorDistance")}>色差${qmark("colorDistance")}</th></tr>
              ${duplicates}
            </table></div>`
          : `<p class="muted">没有近似重复。</p>`
      }
    </div>

    ${matrices}

    <div class="panel">
      <div class="panel-head"><h2>变化轴</h2><span class="meta">${Object.keys(report.axes ?? {}).length} 个轴</span></div>
      ${axes || `<p class="muted">没有可用的变化轴数据。</p>`}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>感知聚类</h2><span class="meta">${(report.clusters ?? []).length} 簇</span></div>
      ${clusters || `<p class="muted">没有聚类。</p>`}
    </div>
  `;

  const refresh = $("#refreshQuality");
  if (refresh) refresh.onclick = () => route();
}

/* ------------------------------------------------------------------ boot */

function clearPageTimers() {
  clearInterval(state.timers.jobs);
  state.timers.jobs = null;
}

function startStatusLoop() {
  clearInterval(state.timers.status);
  state.timers.status = setInterval(async () => {
    if (document.hidden) return;
    try {
      const before = state.status ? overviewSignature(state.status) : null;
      const status = await loadStatus(true);
      const after = overviewSignature(status);
      if (before !== after && state.page === "overview" && !state.modalOpen) {
        await renderOverview();
      }
    } catch {
      /* ignore */
    }
  }, 6000);
}

function setupHints() {
  const tip = document.createElement("div");
  tip.id = "hintTip";
  tip.hidden = true;
  document.body.appendChild(tip);
  let current = null;
  const hide = () => {
    current = null;
    tip.hidden = true;
  };
  const show = (element) => {
    const text = element.dataset.hint;
    if (!text) return;
    current = element;
    tip.textContent = text;
    tip.hidden = false;
    const rect = element.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.left),
    );
    const below = rect.bottom + 8;
    const top =
      below + height > window.innerHeight - 8
        ? rect.top - height - 8
        : below;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };
  document.addEventListener("mouseover", (event) => {
    const element = event.target.closest?.("[data-hint]");
    if (element) show(element);
    else if (current) hide();
  });
  document.addEventListener("mouseout", (event) => {
    const element = event.target.closest?.("[data-hint]");
    if (element && !element.contains(event.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (event) => {
    const element = event.target.closest?.("[data-hint]");
    if (element) show(element);
  });
  document.addEventListener("focusout", hide);
  window.addEventListener("scroll", hide, true);
}

async function boot() {
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", releaseVideos);
  window.addEventListener("pagehide", releaseVideos);

  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("click", (event) => {
    if (event.target === $("#modal")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  setupHints();
  initPreviewMode();

  try {
    await Promise.all([
      loadConfig(),
      loadParameters(),
      loadStatus(true),
      loadLabels(),
    ]);
  } catch (error) {
    toast(error.message);
  }

  startStatusLoop();
  if (!location.hash) location.hash = "#/overview";
  await route();
}

boot();
