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
  taskStage: "mix",
  taskValues: {},
  selectedJob: null,
  eventSource: null,
  timers: { status: null, jobs: null },
};

const CATEGORY_LABELS = {
  icon: "图标",
  text: "文字",
  transition: "转场",
  particle: "粒子",
  camera: "镜头",
  ui: "界面",
  graphic: "图形",
};

const LAYER_LABELS = {
  scene: "场景层",
  overlay: "叠加层",
  transition: "转场层",
};

const STATUS_LABELS = {
  approved: "已批准",
  draft: "待审核",
  retired: "已退役",
};

const FLAG_LABELS = {
  static: "静止",
  blank: "空白",
  "faint-alpha": "极淡透明",
  "empty-alpha": "空透明",
  "alpha-unknown": "透明未知",
  "loop-mismatch": "循环不闭合",
  "end-unsettled": "末帧未稳定",
  "end-residue": "末帧残留",
};

const JOB_STATUS_LABELS = {
  queued: "排队中",
  running: "运行中",
  done: "完成",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "已中断",
};

const STAGE_LABELS = {
  scan: "扫描素材",
  creative: "创意工程",
  quality: "质量分析",
  mix: "混剪成片",
  fission: "批量裂变",
  check: "校验 EDL",
};

const PAGE_META = {
  overview: { title: "概览", subtitle: "素材、任务、成片与质量的一览" },
  assets: { title: "素材", subtitle: "生成素材与实拍素材浏览、审核" },
  creative: { title: "创意", subtitle: "数据驱动的创意工程：参数、文案、变体与素材" },
  tasks: { title: "任务", subtitle: "按参数运行流水线阶段，查看实时日志" },
  outputs: { title: "成片", subtitle: "已渲染成片与对应时间线摘要" },
  quality: { title: "质量", subtitle: "感知聚类、近似重复与覆盖矩阵" },
};

const MATRIX_LABELS = {
  paletteByLayer: "调色板 × 层",
  creativeByPalette: "创意工程 × 调色板",
  engineByLayer: "引擎 × 层",
  scopeByLayer: "范围 × 层",
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
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  return CATEGORY_LABELS[value] ?? value ?? "—";
}

function layerLabel(value) {
  return LAYER_LABELS[value] ?? value ?? "—";
}

function statusLabel(value) {
  return STATUS_LABELS[value] ?? value ?? "—";
}

function flagLabel(value) {
  return FLAG_LABELS[value] ?? value;
}

function stageLabel(value) {
  return STAGE_LABELS[value] ?? value ?? "—";
}

function jobStatusBadge(status) {
  const cls =
    status === "running" ? "accent" : status === "done" ? "ok" : status === "failed" ? "danger" : status === "queued" ? "warn" : "";
  return `<span class="badge ${cls}">${esc(JOB_STATUS_LABELS[status] ?? status)}</span>`;
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
  const status = await loadStatus(true);
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
          <div class="stat"><div class="label">已分析</div><div class="value">${quality.analyzed ?? "—"}</div><div class="hint">共 ${quality.assets ?? "—"} 条</div></div>
          <div class="stat"><div class="label">感知簇</div><div class="value">${quality.clusters ?? "—"}</div><div class="hint">多样性 ${fmtNum(quality.diversity, 3)}</div></div>
          <div class="stat"><div class="label">近似重复</div><div class="value">${quality.nearDuplicates ?? "—"}</div><div class="hint">对</div></div>
          <div class="stat"><div class="label">警告</div><div class="value">${quality.warnings ?? 0}</div><div class="hint">失败 ${quality.flagged ?? 0}</div></div>
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
          <span>${esc(categoryLabel(asset.category))} · ${esc(layerLabel(asset.layer))}</span>
          <span>${asset.seriesIndex !== null && asset.seriesIndex !== undefined ? `#${asset.seriesIndex}` : esc(asset.scope ?? "shared")}</span>
        </div>
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
              ${Object.entries(LAYER_LABELS).map(([value, label]) => `<option value="${value}" ${filters.layer === value ? "selected" : ""}>${label}</option>`).join("")}
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
const BEAT_LABELS = {
  hook: "开场",
  build: "铺垫",
  proof: "证据",
  turn: "转折",
  close: "收束",
};

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
            <span class="badge">${esc(layerLabel(project.engineMeta?.layer))}</span>
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
                    `<label class="creative-role"><input type="checkbox" data-role="${role}" ${effectiveRoles.includes(role) ? "checked" : ""} />${BEAT_LABELS[role]}</label>`,
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
        <div><div class="k">透明覆盖</div><div class="v">${fmtPercent(quality.alphaCoverage)}</div></div>
        <div><div class="k">运动能量</div><div class="v">${fmtNum(quality.motionEnergy, 5)}</div></div>
        <div><div class="k">亮度 / 对比</div><div class="v">${fmtNum(quality.brightness)} / ${fmtNum(quality.contrast)}</div></div>
        <div><div class="k">首尾 Hamming</div><div class="v">${fmtNum(quality.firstLastHamming)}</div></div>
        <div><div class="k">末帧运动</div><div class="v">${fmtNum(quality.endMotion, 5)}</div></div>
        <div><div class="k">末帧透明</div><div class="v">${fmtPercent(quality.alphaEnd)}</div></div>
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
          <span class="badge accent">${esc(categoryLabel(asset.category))}</span>
          <span class="badge">${esc(layerLabel(asset.layer))}</span>
          <span class="badge">${esc(asset.scope ?? "shared")}</span>
          ${asset.alpha ? `<span class="badge">透明</span>` : ""}
          ${asset.loop ? `<span class="badge">循环</span>` : ""}
        </div>
        <div class="kv">
          <div><div class="k">来源</div><div class="v">${esc(asset.creativeId ? `${asset.creativeId}/${asset.variantId}` : (asset.preset ?? "—"))}</div></div>
          <div><div class="k">engine</div><div class="v">${esc(asset.engine ?? "—")}</div></div>
          <div><div class="k">时长</div><div class="v">${fmtDuration(asset.duration)}</div></div>
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
          ${thumbs[0] ? `<img src="${esc(thumbs[0])}" alt="" data-main-thumb />` : "无缩略图"}
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
          <div><div class="k">分辨率</div><div class="v">${asset.width}×${asset.height}</div></div>
          <div><div class="k">文件</div><div class="v">${esc(asset.path ?? "—")}</div></div>
        </div>
      </div>
    </div>`,
  );

  for (const thumb of document.querySelectorAll("#modalBody [data-thumb]")) {
    thumb.onclick = () => {
      const image = $("#modalBody [data-main-thumb]");
      if (image) image.src = thumb.dataset.thumb;
    };
  }
}

const ACTION_LABELS = {
  approve: "批准",
  reject: "退役",
  share: "提升为 shared",
  "clean-work": "清理 work（dry-run）",
};

async function runAssetAction(action, id) {
  releaseVideos();
  closeModal();
  try {
    const job = await postJson("/api/action", { action, id });
    toast(`已提交：${ACTION_LABELS[action] ?? action} ${id}`);
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
          if (field.type === "checkbox") {
            return `<div class="form-row">
              <label for="${id}">${esc(field.label)}</label>
              <input type="checkbox" id="${id}" data-field="${esc(field.name)}" data-type="checkbox" ${values[field.name] ? "checked" : ""} />
            </div>`;
          }
          const type = field.type === "number" ? "number" : "text";
          const placeholder = defaults[field.name] ?? field.placeholder ?? "";
          return `<div class="form-row">
            <label for="${id}">${esc(field.label)}</label>
            <input class="field" type="${type}" id="${id}" data-field="${esc(field.name)}" data-type="${type}"
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
  if (hint) hint.textContent = stageHint(stage);
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
        <td>${esc(layerLabel(layer))}</td>
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
      const head = `<tr><th>${esc(MATRIX_LABELS[key] ?? key)}</th>${matrix.cols.map((col) => `<th>${esc(col)}</th>`).join("")}</tr>`;
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
            <h2>${esc(MATRIX_LABELS[key] ?? key)}</h2>
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
        <td>${esc(layerLabel(item.layer))}</td>
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
          <span>${esc(layerLabel(cluster.layer))} · ${cluster.size} 条</span>
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
        <td>${esc(layerLabel(pair.layer))}</td>
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
      <div class="stat"><div class="label">已分析</div><div class="value">${summary.analyzed ?? "—"}</div><div class="hint">共 ${summary.assets ?? "—"} 条 · 缺失 ${summary.missing ?? 0}</div></div>
      <div class="stat"><div class="label">感知簇</div><div class="value">${summary.clusters ?? "—"}</div><div class="hint">多样性 ${fmtNum(summary.diversity, 3)}</div></div>
      <div class="stat"><div class="label">近似重复</div><div class="value">${summary.nearDuplicates ?? "—"}</div><div class="hint">展示 ${(report.nearDuplicates ?? []).length} 对</div></div>
      <div class="stat"><div class="label">警告 / 失败</div><div class="value">${summary.warnings ?? 0} / ${summary.flagged ?? 0}</div><div class="hint">报告 ${esc(fmtDate(report.generatedAt))}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>分层概览</h2><span class="meta">报告版本 ${esc(report.version ?? "—")}</span></div>
      <div class="table-wrap">
        <table class="data">
          <tr><th>层</th><th>素材</th><th>簇</th><th>多样性</th><th>运动能量</th><th>透明覆盖</th><th>警告</th></tr>
          ${layerRows}
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>质量标记</h2><span class="meta">${flagged.length} 条</span></div>
      ${
        flagged.length
          ? `<div class="table-wrap"><table class="data">
              <tr><th>素材</th><th>层</th><th>类型</th><th>标记</th><th>透明覆盖</th><th>运动能量</th></tr>
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
              <tr><th>A</th><th>B</th><th>层</th><th>score</th><th>Hamming min/mean</th><th>色差</th></tr>
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

  try {
    await Promise.all([loadConfig(), loadParameters(), loadStatus(true)]);
  } catch (error) {
    toast(error.message);
  }

  startStatusLoop();
  if (!location.hash) location.hash = "#/overview";
  await route();
}

boot();
