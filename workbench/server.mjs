#!/usr/bin/env node
/**
 * 本地工作台：包装现有 run.mjs 阶段，提供只读浏览 + 单任务队列 + 实时日志。
 *   node workbench/server.mjs [--port 4317] [--open]
 * 只绑定 127.0.0.1，不引入任何 npm 依赖。
 */
import { spawn, spawnSync } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";
import { diffAssetFiles, findAssetFile } from "../modules/lib/assets.mjs";
import {
  checkResources,
  inventory,
  requirementsStatus,
} from "../modules/lib/resources.mjs";
import {
  loadIconFile,
  marketBrowse,
  marketCollection,
  marketDefaults,
  marketImportArgs,
  marketProviders,
  marketResolve,
  marketSearch,
  prefetchIconFiles,
  providerTemplates,
} from "../modules/lib/market.mjs";
import { registryStatus } from "../modules/creative/registry.mjs";
import {
  projectEngine,
  readCreativeProjects,
  readEngines,
  readLocalEngine,
  validateAll,
  validateProject,
} from "../modules/creative/loader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "workbench", "public");
const cfg = loadConfig([]);
const DATA = cfg.paths.data;
const OUT = cfg.paths.out;
const WB_DIR = path.join(DATA, "workbench");
const LOG_DIR = path.join(WB_DIR, "logs");
const JOBS_FILE = path.join(WB_DIR, "jobs.json");
mkdirSync(LOG_DIR, { recursive: true });

const PORT = Number(
  process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] ??
    (process.argv.includes("--port")
      ? process.argv[process.argv.indexOf("--port") + 1]
      : 4317),
);
const OPEN = process.argv.includes("--open");

const ALLOWED_STAGES = new Set([
  "scan",
  "creative",
  "quality",
  "mix",
  "fission",
  "check",
  "sync",
]);

const ALLOWED_TOOLS = new Set(["tools/assets.mjs", "tools/market.mjs", "run.mjs"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
};

const inside = (root, target) =>
  target === root || target.startsWith(root + path.sep);

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function mediaUrl(file) {
  if (!file) return null;
  const abs = path.resolve(file);
  for (const [root, prefix] of [
    [OUT, "out"],
    [DATA, "data"],
  ]) {
    if (!inside(root, abs)) continue;
    const rel = path
      .relative(root, abs)
      .split(path.sep)
      .map(encodeURIComponent)
      .join("/");
    return `/media/${prefix}/${rel}`;
  }
  return null;
}

function assetMediaUrl(relative) {
  if (!relative) return null;
  const clean = String(relative).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!findAssetFile(cfg.assetRoots, clean)) return null;
  return `/media/assets/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

function fileStat(file) {
  if (!file) return { size: null, mtime: null };
  try {
    const stat = statSync(file);
    return { size: stat.size, mtime: stat.mtime.toISOString() };
  } catch {
    return { size: null, mtime: null };
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function pipeFile(res, file, options) {
  const stream = createReadStream(file, options);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

function serveFile(req, res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    text(res, 404, "Not found");
    return;
  }
  const size = statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range));
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      pipeFile(res, file, { start, end });
      return;
    }
  }
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  });
  pipeFile(res, file);
}

// ---------------------------------------------------------------- jobs

const jobs = new Map();
const queue = [];
let active = null;
let counter = 0;

function loadJobs() {
  const list = readJson(JOBS_FILE, []);
  for (const job of Array.isArray(list) ? list : []) {
    if (!job?.id) continue;
    if (job.status === "running" || job.status === "queued") {
      job.status = "interrupted";
      job.endedAt = job.endedAt ?? new Date().toISOString();
    }
    jobs.set(job.id, job);
  }
}

function publicJob(job) {
  const { child, listeners, logStream, command, ...rest } = job;
  return rest;
}

function persistJobs() {
  writeJson(
    JOBS_FILE,
    [...jobs.values()].map(publicJob).slice(-60),
  );
}

function broadcast(job, payload) {
  if (!job.listeners) return;
  for (const send of job.listeners) send(payload);
}

function appendLog(job, chunk) {
  const value = String(chunk);
  if (job.logStream) job.logStream.write(value);
  broadcast(job, { type: "log", chunk: value });
}

function finishJob(job, code) {
  if (job.status !== "cancelled" && job.status !== "interrupted") {
    job.status = code === 0 ? "done" : "failed";
  }
  job.exitCode = code;
  job.endedAt = new Date().toISOString();
  if (job.logStream) {
    job.logStream.end();
    job.logStream = null;
  }
  broadcast(job, { type: "status", job: publicJob(job) });
  broadcast(job, { type: "exit", code, status: job.status });
  if (active === job) active = null;
  persistJobs();
  const next = queue.shift();
  if (next) startJob(next);
}

function startJob(job) {
  active = job;
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.logStream = createWriteStream(job.logFile, { flags: "a" });
  job.listeners = job.listeners ?? new Set();
  const command = job.command ?? {
    script: path.join(ROOT, "run.mjs"),
    args: [job.stage, ...job.args],
  };
  const display = path.relative(ROOT, command.script).split(path.sep).join("/");
  appendLog(job, `\n[job] node ${display} ${command.args.join(" ")}\n\n`);

  const child = spawn(
    process.execPath,
    [command.script, ...command.args],
    {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "0" },
      windowsHide: true,
    },
  );
  job.child = child;
  job.pid = child.pid;
  child.stdout.on("data", (chunk) => appendLog(job, chunk));
  child.stderr.on("data", (chunk) => appendLog(job, chunk));
  child.on("error", (error) => {
    appendLog(job, `\n[job] spawn error: ${error.message}\n`);
    finishJob(job, 1);
  });
  child.on("close", (code) => finishJob(job, code ?? 1));
  persistJobs();
  broadcast(job, { type: "status", job: publicJob(job) });
}

function enqueueJob(stage, args) {
  if (!ALLOWED_STAGES.has(stage)) {
    throw new Error(`不支持的 stage：${stage}`);
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("args 必须是字符串数组");
  }
  if (args.join(" ").length > 4000) throw new Error("参数过长");
  counter += 1;
  const id = `job-${Date.now().toString(36)}-${counter}`;
  const job = {
    id,
    stage,
    args,
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    exitCode: null,
    logFile: path.join(LOG_DIR, `${id}.log`),
  };
  jobs.set(id, job);
  writeFileSync(job.logFile, "");
  if (active) {
    queue.push(job);
  } else {
    startJob(job);
  }
  persistJobs();
  return job;
}

function enqueueTool(label, scriptRel, args) {
  if (!ALLOWED_TOOLS.has(scriptRel)) {
    throw new Error(`不支持的工具：${scriptRel}`);
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("args 必须是字符串数组");
  }
  if (args.join(" ").length > 4000) throw new Error("参数过长");
  const script = path.join(ROOT, scriptRel);
  if (!existsSync(script)) throw new Error(`缺少工具脚本：${scriptRel}`);
  counter += 1;
  const id = `job-${Date.now().toString(36)}-${counter}`;
  const job = {
    id,
    stage: label,
    args,
    command: { script, args },
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    exitCode: null,
    logFile: path.join(LOG_DIR, `${id}.log`),
  };
  jobs.set(id, job);
  writeFileSync(job.logFile, "");
  if (active) {
    queue.push(job);
  } else {
    startJob(job);
  }
  persistJobs();
  return job;
}

function cancelJob(job) {
  if (job.status === "queued") {
    const index = queue.indexOf(job);
    if (index >= 0) queue.splice(index, 1);
    job.status = "cancelled";
    job.endedAt = new Date().toISOString();
    persistJobs();
    return true;
  }
  if (job.status !== "running" || !job.child) return false;
  job.status = "cancelled";
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(job.child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    job.child.kill("SIGTERM");
  }
  return true;
}

function tailFile(file, bytes) {
  if (!existsSync(file)) return "";
  const data = readFileSync(file);
  return data.subarray(Math.max(0, data.length - bytes)).toString("utf8");
}

function streamJob(req, res, job) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      /* client gone */
    }
  };
  const existing = tailFile(job.logFile, 160 * 1024);
  if (existing) send({ type: "log", chunk: existing });
  send({ type: "status", job: publicJob(job) });
  if (["done", "failed", "cancelled", "interrupted"].includes(job.status)) {
    send({ type: "exit", code: job.exitCode ?? 0 });
    res.end();
    return;
  }
  job.listeners = job.listeners ?? new Set();
  job.listeners.add(send);
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      /* ignore */
    }
  }, 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    job.listeners?.delete(send);
  });
}

// ---------------------------------------------------------------- data

function listCatalog() {
  const catalog = readJson(path.join(DATA, "catalog.json"), { assets: [] });
  return (catalog.assets ?? []).map((asset) => {
    const info = fileStat(asset.fileMp4);
    return {
      id: asset.id,
      preset: asset.preset,
      engine: asset.engine ?? null,
      layer: asset.layer ?? "scene",
      category: asset.category ?? asset.quality?.category ?? null,
      series: asset.series ?? null,
      seriesIndex: asset.seriesIndex ?? null,
      scope: asset.scope ?? "shared",
      workId: asset.workId ?? null,
      status: asset.status ?? "approved",
      creativeId: asset.creativeId ?? null,
      variantId: asset.variantId ?? null,
      creativeVersion: asset.creativeVersion ?? null,
      variantVersion: asset.variantVersion ?? null,
      style: asset.style ?? null,
      paramsHash: asset.paramsHash ?? null,
      itemId: asset.itemId ?? null,
      duration: asset.duration,
      alpha: Boolean(asset.alpha),
      loop: Boolean(asset.loop),
      tags: asset.tags ?? {},
      variation: asset.variation ?? null,
      quality: asset.quality ?? null,
      size: info.size,
      mtime: info.mtime,
      thumb: mediaUrl(asset.stills?.[0]) ?? mediaUrl(asset.fileMp4),
      mp4: mediaUrl(asset.fileMp4),
      webm: mediaUrl(asset.fileWebm),
      stills: (asset.stills ?? []).map(mediaUrl).filter(Boolean),
    };
  });
}

function listLibrary() {
  const library = readJson(path.join(DATA, "library.json"), { assets: [] });
  return (library.assets ?? []).map((asset) => ({
    id: asset.id,
    name: asset.relPath ?? asset.name ?? path.basename(asset.path ?? ""),
    path: asset.source ?? asset.path,
    type: asset.type,
    size: asset.size ?? null,
    mtime: asset.mtimeMs ? new Date(asset.mtimeMs).toISOString() : null,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    status: asset.status,
    thumbs: (asset.thumbs ?? [])
      .map((thumb) => mediaUrl(path.isAbsolute(thumb) ? thumb : path.join(DATA, thumb)))
      .filter(Boolean),
    scenes: asset.scenes?.length ?? 0,
  }));
}

function listOutputs() {
  if (!existsSync(OUT)) return [];
  const edlDir = path.join(DATA, "edl");
  return readdirSync(OUT)
    .filter((file) => file.toLowerCase().endsWith(".mp4"))
    .map((file) => {
      const full = path.join(OUT, file);
      const stat = statSync(full);
      const id = path.basename(file, ".mp4");
      const edl = readJson(path.join(edlDir, `${id}.json`), null);
      const shots = edl?.beats?.flatMap((beat) => beat.shots ?? []) ?? [];
      const stillDir = path.join(OUT, "stills", id);
      const posters = existsSync(stillDir)
        ? readdirSync(stillDir)
            .filter((name) => name.toLowerCase().endsWith(".png"))
            .sort()
        : [];
      return {
        id,
        file: full,
        url: mediaUrl(full),
        poster: posters.length
          ? mediaUrl(path.join(stillDir, posters[0]))
          : null,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        duration: edl ? edl.durationInFrames / edl.fps : null,
        shots: shots.length,
        footage: shots.filter((shot) => shot.kind === "footage").length,
        generated: shots.filter((shot) => shot.kind === "generated").length,
        workProfile: edl?.workProfile ?? null,
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function listCreativePreviews(creativeId, variantId) {
  const dir = path.join(OUT, "creatives", creativeId, variantId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .sort()
    .map((name) => mediaUrl(path.join(dir, name)))
    .filter(Boolean);
}

function syncPayload() {
  const registry = registryStatus(cfg);
  const manifestFile = path.join(cfg.paths.shared, "assets.manifest.json");
  let assets = { manifest: false, entries: 0, added: 0, changed: 0, missing: 0 };
  if (existsSync(manifestFile)) {
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    const diff = diffAssetFiles(manifest.assets ?? [], cfg.assetRoots);
    assets = {
      manifest: true,
      roots: cfg.assetRoots.map((root) => path.relative(ROOT, root).split(path.sep).join("/")),
      entries: manifest.assets?.length ?? 0,
      added: diff.added.length,
      changed: diff.changed.length,
      missing: diff.missing.length,
    };
  }
  return { registry, assets };
}

function resourcesPayload() {
  const inv = inventory(cfg);
  const issues = checkResources(cfg, { verify: false });
  const requirements = requirementsStatus(cfg);
  const counts = {};
  const normalizeKind = (kind) => String(kind ?? "other").replace(/s$/, "");
  const mediaExt = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".avif",
    ".gif",
    ".svg",
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".flac",
  ]);
  for (const entry of inv.entries) {
    const kind = normalizeKind(entry.kind);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return {
    roots: cfg.assetRoots.map((root) =>
      path.relative(ROOT, root).split(path.sep).join("/"),
    ),
    manifest: {
      exists: inv.manifestExists,
      entries: inv.entries.length,
      generatedAt: inv.manifest.generatedAt ?? null,
    },
    counts,
    entries: inv.entries.map((entry) => {
      const info = fileStat(findAssetFile(cfg.assetRoots, entry.path));
      return {
        path: entry.path,
        kind: normalizeKind(entry.kind),
        size: info.size ?? entry.size ?? null,
        mtime: info.mtime,
        license: entry.license ?? "unknown",
        source: entry.source ?? null,
        family: entry.family ?? null,
        weight: entry.weight ?? null,
        style: entry.style ?? null,
        media: (mediaExt.has(path.extname(entry.path).toLowerCase()) ||
          /\.(woff2?|ttf|otf)$/i.test(entry.path))
          ? assetMediaUrl(entry.path)
          : null,
      };
    }),
    fonts: inv.fonts.map((entry) => {
      const info = fileStat(findAssetFile(cfg.assetRoots, entry.path));
      return {
        path: entry.path,
        family: entry.family,
        weight: entry.weight,
        style: entry.style ?? null,
        license: entry.license ?? "unknown",
        source: entry.source ?? null,
        size: info.size,
        mtime: info.mtime,
        media: assetMediaUrl(entry.path),
      };
    }),
    music: inv.music.map((track) => {
      const info = fileStat(track.resolved?.file);
      return {
        id: track.id,
        file: track.file,
        title: track.title,
        mood: track.mood,
        energy: track.energy,
        bpm: track.bpm,
        duration: track.duration,
        license: track.license ?? "unknown",
        source: track.source ?? null,
        size: info.size,
        mtime: info.mtime,
        src: track.resolved?.src ?? null,
        media: track.resolved ? assetMediaUrl(track.resolved.relative) : null,
      };
    }),
    sfx: inv.sfx.map((item) => {
      const info = fileStat(item.resolved?.file);
      return {
        id: item.id,
        file: item.file,
        category: item.category,
        gain: item.gain,
        duration: item.duration,
        license: item.license ?? "unknown",
        source: item.source ?? null,
        size: info.size,
        mtime: info.mtime,
        src: item.resolved?.src ?? null,
        media: item.resolved ? assetMediaUrl(item.resolved.relative) : null,
      };
    }),
    issues,
    requirements,
  };
}

function modulesPayload() {
  const catalog = readJson(path.join(DATA, "catalog.json"), { assets: [] }).assets ?? [];
  const library = readJson(path.join(DATA, "library.json"), { assets: [] }).assets ?? [];
  const quality = readJson(path.join(DATA, "quality", "report.json"), null);
  const outputs = listOutputs();
  const registry = registryStatus(cfg);
  const inv = inventory(cfg);
  const works = new Set(catalog.filter((asset) => asset.workId).map((asset) => asset.workId));
  let projects = 0;
  if (existsSync(cfg.paths.creative)) {
    projects = readdirSync(cfg.paths.creative, { withFileTypes: true }).filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(path.join(cfg.paths.creative, entry.name, "creative.json")),
    ).length;
  }
  const lastByStage = {};
  for (const job of [...jobs.values()].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  )) {
    if (job.stage) lastByStage[job.stage] = publicJob(job);
  }
  const qualitySummary = quality?.summary;
  const qualityText = qualitySummary
    ? `${qualitySummary.analyzed}/${qualitySummary.assets} 条 / ${qualitySummary.nearDuplicates} 近似`
    : "未生成报告";
  return {
    counts: {
      footage: library.length,
      catalog: catalog.length,
      outputs: outputs.length,
      projects,
      works: works.size,
    },
    modules: [
      {
        id: "scan",
        label: "扫描素材",
        command: "node run.mjs scan",
        summary: `实拍 ${library.length} 条`,
        detail: `素材根 ${cfg.footage.roots.length} 个`,
        last: lastByStage.scan ?? null,
      },
      {
        id: "creative",
        label: "创意工程",
        command: "node run.mjs creative build",
        summary: `${projects} 个工程`,
        detail: `生成素材 ${catalog.length} 条`,
        last: lastByStage.creative ?? null,
      },
      {
        id: "quality",
        label: "质量分析",
        command: "node run.mjs quality",
        summary: qualityText,
        detail: "pHash / 聚类 / 覆盖矩阵",
        last: lastByStage.quality ?? null,
      },
      {
        id: "mix",
        label: "混剪成片",
        command: "node run.mjs mix",
        summary: `${outputs.length} 条成片`,
        detail: `默认 ${cfg.mix.duration}s / seed ${cfg.mix.seed}`,
        last: lastByStage.mix ?? null,
      },
      {
        id: "fission",
        label: "批量裂变",
        command: "node run.mjs fission",
        summary: `${works.size} 个作品`,
        detail: cfg.fission.generateAssets ? "生成作品专属素材" : "只用 shared 素材",
        last: lastByStage.fission ?? null,
      },
      {
        id: "sync",
        label: "内容同步",
        command: "node run.mjs sync",
        summary: registry.ok ? "注册表最新" : "注册表待更新",
        detail: `清单 ${inv.entries.length} 条 / 未登记 ${inv.diff.added.length}`,
        last: lastByStage.sync ?? null,
      },
      {
        id: "shared",
        label: "公共资源",
        command: "node run.mjs shared status",
        summary: `${inv.entries.length} 条资源`,
        detail: `字体 ${inv.fonts.length} / BGM ${inv.music.length} / SFX ${inv.sfx.length}`,
        last: null,
      },
    ],
  };
}

function creativePayload() {
  const { engines, projects, errors, warnings } = validateAll(cfg);
  const catalog = readJson(path.join(DATA, "catalog.json"), { assets: [] }).assets ?? [];
  const buildState = readJson(
    path.join(DATA, "creative", "build-state.json"),
    null,
  );

  const payload = projects.map((project) => {
    const engine = projectEngine(project, engines);
    return {
      id: project.id,
      name: project.name,
      version: project.version,
      intent: project.intent ?? "",
      engine: project.engine,
      status: project.status ?? "active",
      appliesTo: project.appliesTo ?? {},
      params: project.params ?? {},
      content: project.content ?? {},
      file: project.file,
      engineMeta: engine
        ? {
            id: engine.id,
            label: engine.label,
            preset: engine.preset,
            category: engine.category,
            layer: engine.layer,
            alpha: engine.alpha,
            loop: Boolean(engine.loop),
            complete: engine.complete ?? null,
            shared: engine.shared ?? {},
            styles: engine.styles ?? {},
          }
        : null,
      variants: project.variants.map((variant) => {
        const style = engine?.styles?.[variant.style] ?? null;
        const assets = catalog.filter(
          (asset) =>
            asset.creativeId === project.id && asset.variantId === variant.id,
        );
        return {
          id: variant.id,
          name: variant.name,
          version: variant.version ?? 1,
          style: variant.style,
          status: variant.status ?? "draft",
          enabled: variant.enabled !== false,
          beatRoles: variant.beatRoles ?? [],
          durationFrames: variant.durationFrames ?? style?.durationFrames ?? null,
          params: variant.params ?? {},
          items: variant.items ?? [],
          file: variant.file,
          styleMeta: style
            ? {
                label: style.label,
                code: style.code,
                durationFrames: style.durationFrames,
                beatRoles: style.beatRoles ?? [],
                prompt: style.prompt ?? "",
                params: style.params ?? {},
              }
            : null,
          built:
            buildState?.creatives?.[project.id]?.variants?.[variant.id] ?? null,
          previews: listCreativePreviews(project.id, variant.id),
          assets: assets.map((asset) => ({
            id: asset.id,
            itemId: asset.itemId ?? null,
            status: asset.status ?? "draft",
            duration: asset.duration,
            paramsHash: asset.paramsHash ?? null,
            quality: asset.quality
              ? { ok: asset.quality.ok, flags: asset.quality.flags ?? [] }
              : null,
            stills: (asset.stills ?? []).map(mediaUrl).filter(Boolean),
            mp4: mediaUrl(asset.fileMp4),
            webm: mediaUrl(asset.fileWebm),
          })),
        };
      }),
    };
  });

  return {
    engines: Object.fromEntries(
      [...engines.entries()].map(([id, engine]) => [
        id,
        {
          id,
          label: engine.label,
          preset: engine.preset,
          category: engine.category,
          layer: engine.layer,
          alpha: engine.alpha,
          loop: Boolean(engine.loop),
          complete: engine.complete ?? null,
          shared: engine.shared ?? {},
          styles: engine.styles ?? {},
        },
      ]),
    ),
    projects: payload,
    errors,
    warnings,
    sync: syncPayload(),
  };
}

function saveCreativeVariant(creativeId, variantId, body) {
  const projects = readCreativeProjects(cfg);
  const project = projects.find((item) => item.id === creativeId);
  if (!project) throw new Error(`创意工程不存在：${creativeId}`);
  const variant = project.variants.find((item) => item.id === variantId);
  if (!variant) throw new Error(`变体不存在：${variantId}`);

  const allowed = [
    "name",
    "enabled",
    "style",
    "status",
    "beatRoles",
    "params",
    "items",
    "durationFrames",
    "loop",
  ];
  const next = { ...variant };
  delete next.file;
  delete next.dir;
  for (const key of allowed) {
    if (body[key] !== undefined) next[key] = body[key];
  }

  const renderSignature = (value) =>
    JSON.stringify({
      style: value.style ?? null,
      params: value.params ?? {},
      items: value.items ?? [],
      durationFrames: value.durationFrames ?? null,
      loop: value.loop ?? null,
    });
  const changed = renderSignature(next) !== renderSignature(variant);
  next.version = Number(variant.version ?? 1) + (changed ? 1 : 0);

  const engines = readEngines(cfg).engines;
  const nextProject = {
    ...project,
    variants: project.variants.map((item) =>
      item.id === variantId ? next : item,
    ),
  };
  const engine = String(nextProject.engine ?? "").startsWith("./")
    ? readLocalEngine(cfg, nextProject, [])
    : (engines.get(nextProject.engine) ?? null);
  const result = validateProject(nextProject, {
    engines,
    maxAssets: Number(cfg.creative?.maxAssetsPerVariant ?? 24),
    engine,
  });
  if (result.errors.length) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }

  const file = path.join(
    cfg.paths.creative,
    project.dirName,
    "variants",
    `${variantId}.json`,
  );
  if (!inside(cfg.paths.creative, file)) throw new Error("路径越界");
  const temp = `${file}.tmp`;
  writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(temp, file);
  return { ok: true, variant: next, changed, warnings: result.warnings };
}

function workbenchConfig() {
  const data = readJson(path.join(ROOT, "config", "workbench.json"), {
    version: 1,
    stages: {},
    labels: {},
  });
  return {
    version: data?.version ?? 1,
    stages: data?.stages ?? {},
    labels: data?.labels ?? {},
  };
}

function labelsPayload() {
  const data = workbenchConfig();
  return { version: data.version, groups: data.labels };
}

function statusPayload() {
  const catalog = readJson(path.join(DATA, "catalog.json"), { assets: [] }).assets ?? [];
  const library = readJson(path.join(DATA, "library.json"), { assets: [] }).assets ?? [];
  const approved = catalog.filter((asset) => (asset.status ?? "approved") === "approved").length;
  const draft = catalog.filter((asset) => asset.status === "draft").length;
  const retired = catalog.filter((asset) => asset.status === "retired").length;
  const works = new Set(
    catalog.filter((asset) => asset.workId).map((asset) => asset.workId),
  );
  const quality = readJson(path.join(DATA, "quality", "report.json"), null);
  const outputs = listOutputs();
  return {
    counts: {
      footage: library.length,
      catalog: catalog.length,
      approved,
      draft,
      retired,
      works: works.size,
      outputs: outputs.length,
    },
    current: active ? publicJob(active) : null,
    queue: queue.map(publicJob),
    recentOutputs: outputs.slice(0, 6),
    quality: quality?.summary ?? null,
  };
}

// ---------------------------------------------------------------- http

async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("请求体过大");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function safeText(label, value, max = 200) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.startsWith("-")) throw new Error(`${label} 不能以 - 开头`);
  if (text.length > max) throw new Error(`${label} 过长`);
  return text;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/status" && req.method === "GET") {
      json(res, 200, statusPayload());
      return;
    }
    if (pathname === "/api/config" && req.method === "GET") {
      json(res, 200, {
        spec: cfg.spec,
        footage: { roots: cfg.footage.roots },
        mix: cfg.mix,
        fission: cfg.fission,
        quality: cfg.quality,
        creative: cfg.creative,
        paths: {
          data: DATA,
          out: OUT,
          public: cfg.paths.public,
          cache: cfg.paths.cache,
          temp: cfg.paths.temp,
          release: cfg.paths.release,
          creative: cfg.paths.creative,
        },
      });
      return;
    }
    if (pathname === "/api/components" && req.method === "GET") {
      const file = path.join(ROOT, "config", "components.json");
      json(res, 200, readJson(file, { version: 1, projects: [] }));
      return;
    }
    if (pathname === "/api/parameters" && req.method === "GET") {
      const data = workbenchConfig();
      json(res, 200, { version: data.version, stages: data.stages });
      return;
    }
    if (pathname === "/api/labels" && req.method === "GET") {
      json(res, 200, labelsPayload());
      return;
    }
    if (pathname === "/api/market/providers" && req.method === "GET") {
      json(res, 200, {
        providers: marketProviders(cfg),
        defaults: marketDefaults(cfg),
        templates: providerTemplates(cfg),
      });
      return;
    }
    if (pathname === "/api/market/providers" && req.method === "POST") {
      const body = await readBody(req);
      const action = String(body.action ?? "");
      if (!["add", "set", "remove"].includes(action)) {
        throw new Error("action 只能是 add / set / remove");
      }
      const id = safeText("市场源 id", body.id, 40);
      if (!id) throw new Error("缺少市场源 id");
      const args = ["providers", action, id];
      if (action === "add") {
        const type = safeText("type", body.type);
        const label = safeText("label", body.label);
        const kind = safeText("kind", body.kind);
        const baseUrl = safeText("baseUrl", body.baseUrl, 500);
        const catalogUrl = safeText("catalogUrl", body.catalogUrl, 500);
        const subset = safeText("subset", body.subset, 40);
        const searchPlaceholder = safeText("searchPlaceholder", body.searchPlaceholder);
        if (type) args.push("--type", type);
        if (label) args.push("--label", label);
        if (kind) args.push("--kind", kind);
        if (baseUrl) args.push("--base-url", baseUrl);
        if (catalogUrl) args.push("--catalog-url", catalogUrl);
        if (subset) args.push("--subset", subset);
        if (searchPlaceholder) args.push("--search-placeholder", searchPlaceholder);
      }
      if (action === "set") {
        const label = safeText("label", body.label);
        const kind = safeText("kind", body.kind);
        const baseUrl = safeText("baseUrl", body.baseUrl, 500);
        const catalogUrl = safeText("catalogUrl", body.catalogUrl, 500);
        const subset = safeText("subset", body.subset, 40);
        const searchPlaceholder = safeText("searchPlaceholder", body.searchPlaceholder);
        if (label) args.push("--label", label);
        if (kind) args.push("--kind", kind);
        if (baseUrl) args.push("--base-url", baseUrl);
        if (catalogUrl) args.push("--catalog-url", catalogUrl);
        if (subset) args.push("--subset", subset);
        if (searchPlaceholder) args.push("--search-placeholder", searchPlaceholder);
        if (body.cacheHours !== undefined && body.cacheHours !== null && String(body.cacheHours).trim() !== "") {
          const hours = Number(body.cacheHours);
          if (!Number.isFinite(hours) || hours < 1) throw new Error("cacheHours 必须是正数");
          args.push("--cache-hours", String(hours));
        }
        if (body.enabled !== undefined) {
          args.push("--enabled", body.enabled === false || body.enabled === "false" ? "false" : "true");
        }
      }
      const job = enqueueTool("market:providers", "tools/market.mjs", args);
      json(res, 202, publicJob(job));
      return;
    }
    if (pathname === "/api/market/search" && req.method === "GET") {
      try {
        const limitParam = url.searchParams.get("limit");
        const result = await marketSearch(cfg, url.searchParams.get("q") ?? "", {
          limit: limitParam === null ? undefined : Number(limitParam),
          providerId: url.searchParams.get("provider"),
        });
        const byPrefix = new Map();
        for (const entry of result.entries) {
          if (entry.kind === "font" || !entry.prefix || !entry.name) continue;
          const names = byPrefix.get(entry.prefix) ?? [];
          names.push(entry.name);
          byPrefix.set(entry.prefix, names);
        }
        for (const [prefix, names] of byPrefix) {
          prefetchIconFiles(cfg, result.provider, prefix, names);
        }
        json(res, 200, result);
      } catch (error) {
        json(res, 502, { error: error.message });
      }
      return;
    }
    if (pathname === "/api/market/collection" && req.method === "GET") {
      try {
        const offsetParam = url.searchParams.get("offset");
        const limitParam = url.searchParams.get("limit");
        const result = await marketCollection(cfg, {
          providerId: url.searchParams.get("provider"),
          prefix: url.searchParams.get("prefix") ?? "",
          query: url.searchParams.get("q") ?? "",
          offset: offsetParam === null ? 0 : Number(offsetParam),
          limit: limitParam === null ? undefined : Number(limitParam),
        });
        prefetchIconFiles(
          cfg,
          result.provider,
          result.prefix,
          result.entries.map((entry) => entry.name),
        );
        json(res, 200, result);
      } catch (error) {
        json(res, 502, { error: error.message });
      }
      return;
    }
    if (pathname === "/api/market/browse" && req.method === "GET") {
      try {
        const offsetParam = url.searchParams.get("offset");
        const limitParam = url.searchParams.get("limit");
        const result = await marketBrowse(cfg, {
          providerId: url.searchParams.get("provider"),
          category: url.searchParams.get("category") ?? "",
          query: url.searchParams.get("q") ?? "",
          offset: offsetParam === null ? 0 : Number(offsetParam),
          limit: limitParam === null ? undefined : Number(limitParam),
        });
        for (const entry of result.entries) {
          prefetchIconFiles(
            cfg,
            entry.provider,
            entry.prefix,
            (entry.samples ?? []).map((sample) => sample.name),
          );
        }
        json(res, 200, result);
      } catch (error) {
        json(res, 502, { error: error.message });
      }
      return;
    }
    if (pathname === "/api/market/import" && req.method === "POST") {
      const body = await readBody(req);
      const icon = safeText("资源 id", body.icon, 120);
      if (!icon) throw new Error("缺少资源 id");
      try {
        const entry = await marketResolve(cfg, icon, {
          providerId: body.provider ? String(body.provider) : null,
        });
        const args = marketImportArgs(entry, { force: Boolean(body.force) });
        const job = enqueueTool("assets:add", "tools/assets.mjs", args);
        json(res, 202, { job: publicJob(job), entry });
      } catch (error) {
        json(res, 502, { error: error.message });
      }
      return;
    }
    if (pathname === "/api/catalog" && req.method === "GET") {
      json(res, 200, { assets: listCatalog() });
      return;
    }
    if (pathname === "/api/library" && req.method === "GET") {
      json(res, 200, { assets: listLibrary() });
      return;
    }
    if (pathname === "/api/outputs" && req.method === "GET") {
      json(res, 200, { outputs: listOutputs() });
      return;
    }
    if (pathname === "/api/quality" && req.method === "GET") {
      const report = readJson(path.join(DATA, "quality", "report.json"), null);
      if (report) {
        const catalog = readJson(path.join(DATA, "catalog.json"), { assets: [] });
        report.catalogCount = (catalog.assets ?? []).filter(
          (asset) => asset.status !== "retired",
        ).length;
      }
      json(res, 200, report);
      return;
    }
    if (pathname === "/api/creative" && req.method === "GET") {
      json(res, 200, creativePayload());
      return;
    }
    if (pathname === "/api/resources" && req.method === "GET") {
      json(res, 200, resourcesPayload());
      return;
    }
    if (pathname === "/api/modules" && req.method === "GET") {
      json(res, 200, modulesPayload());
      return;
    }
    if (pathname === "/api/resources/import" && req.method === "POST") {
      const body = await readBody(req);
      const targets = (Array.isArray(body.paths) ? body.paths : [body.path])
        .map((value) => safeText("路径", value, 1000))
        .filter(Boolean);
      if (!targets.length) throw new Error("缺少导入路径");
      if (targets.length > 50) throw new Error("一次最多 50 个目标");
      const args = ["add", ...targets];
      if (body.keep) args.push("--keep");
      const kind = safeText("kind", body.kind);
      const license = safeText("license", body.license);
      const source = safeText("source", body.source);
      if (kind) args.push("--kind", kind);
      if (license) args.push("--license", license);
      if (source) args.push("--source", source);
      const job = enqueueTool("assets:add", "tools/assets.mjs", args);
      json(res, 202, publicJob(job));
      return;
    }
    if (pathname === "/api/resources/meta" && req.method === "POST") {
      const body = await readBody(req);
      if (body.type === "font") {
        const target = safeText("字体路径", body.path, 1000);
        if (!target) throw new Error("缺少字体路径");
        const args = ["font", "set", target];
        for (const [key, flagName] of [
          ["family", "--family"],
          ["weight", "--weight"],
          ["style", "--style"],
        ]) {
          const value = safeText(key, body[key]);
          if (value) args.push(flagName, value);
        }
        if (args.length === 3) throw new Error("没有要修改的字体字段");
        const job = enqueueTool("assets:font-set", "tools/assets.mjs", args);
        json(res, 202, publicJob(job));
        return;
      }
      if (body.type === "audio") {
        const id = safeText("音频 id", body.id);
        if (!id) throw new Error("缺少音频 id");
        const args = ["audio", "set", id];
        const audioKind = safeText("kind", body.audioKind);
        if (audioKind) {
          if (!["music", "sfx"].includes(audioKind)) {
            throw new Error("audioKind 只能是 music / sfx");
          }
          args.push("--kind", audioKind);
        }
        for (const key of ["category", "mood", "energy", "title", "artist", "license"]) {
          const value = safeText(key, body[key]);
          if (value) args.push(`--${key}`, value);
        }
        for (const key of ["gain", "bpm"]) {
          if (
            body[key] === undefined ||
            body[key] === null ||
            String(body[key]).trim() === ""
          ) {
            continue;
          }
          const value = Number(body[key]);
          if (!Number.isFinite(value)) throw new Error(`${key} 必须是数字`);
          args.push(`--${key}`, String(value));
        }
        const roles = Array.isArray(body.roles)
          ? body.roles.map((role) => safeText("role", role)).filter(Boolean)
          : [];
        if (roles.length) args.push("--roles", roles.join(","));
        if (args.length === 3) throw new Error("没有要修改的音频字段");
        const job = enqueueTool("assets:audio-set", "tools/assets.mjs", args);
        json(res, 202, publicJob(job));
        return;
      }
      throw new Error("type 只能是 font 或 audio");
    }
    if (pathname === "/api/resources/scan" && req.method === "POST") {
      const body = await readBody(req);
      const action = String(body.action ?? "");
      const map = {
        assets: ["assets:scan", "tools/assets.mjs", ["scan", "--apply"]],
        audio: ["assets:audio-scan", "tools/assets.mjs", ["audio", "scan", "--apply"]],
        fonts: ["shared:fonts", "run.mjs", ["shared", "fonts", "--write"]],
      };
      const entry = map[action];
      if (!entry) throw new Error("action 只能是 assets / audio / fonts");
      const job = enqueueTool(entry[0], entry[1], entry[2]);
      json(res, 202, publicJob(job));
      return;
    }
    if (pathname === "/api/resources/remove" && req.method === "POST") {
      const body = await readBody(req);
      const target = safeText("路径", body.path, 1000);
      if (!target) throw new Error("缺少资源路径");
      const args = ["remove", target];
      if (body.keepFile) args.push("--keep-file");
      const job = enqueueTool("assets:remove", "tools/assets.mjs", args);
      json(res, 202, publicJob(job));
      return;
    }
    if (pathname === "/api/sync" && req.method === "GET") {
      json(res, 200, syncPayload());
      return;
    }
    if (pathname === "/api/sync" && req.method === "POST") {
      const body = await readBody(req);
      const job = enqueueJob("sync", body.check ? ["--check"] : ["--apply"]);
      json(res, 202, publicJob(job));
      return;
    }

    const creativeVariant = pathname.match(
      /^\/api\/creative\/([^/]+)\/variant\/([^/]+)$/,
    );
    if (creativeVariant && req.method === "POST") {
      const body = await readBody(req);
      const result = saveCreativeVariant(
        decodeURIComponent(creativeVariant[1]),
        decodeURIComponent(creativeVariant[2]),
        body,
      );
      json(res, result.ok ? 200 : 400, result);
      return;
    }

    const creativeAction = pathname.match(
      /^\/api\/creative\/([^/]+)\/(build|preview|review)$/,
    );
    if (creativeAction && req.method === "POST") {
      const id = decodeURIComponent(creativeAction[1]);
      const action = creativeAction[2];
      const body = await readBody(req);
      const args = [action, "--creative", id];
      if (body.variant) args.push("--variant", String(body.variant));
      if (body.item) args.push("--item", String(body.item));
      if (action === "build" && body.force) args.push("--force");
      if (action === "preview" && body.frame !== undefined && body.frame !== null) {
        args.push("--frame", String(body.frame));
      }
      if (action === "review") {
        if (!["approved", "retired"].includes(body.status)) {
          throw new Error("--status 只能是 approved / retired");
        }
        args.push("--status", body.status);
        if (body.assetId) args.push("--id", String(body.assetId));
      }
      const job = enqueueJob("creative", args);
      json(res, 202, publicJob(job));
      return;
    }

    if (pathname === "/api/jobs" && req.method === "GET") {      json(res, 200, {
        jobs: [...jobs.values()].map(publicJob).reverse().slice(0, 60),
        active: active ? publicJob(active) : null,
        queue: queue.map(publicJob),
      });
      return;
    }
    if (pathname === "/api/jobs" && req.method === "POST") {
      const body = await readBody(req);
      const job = enqueueJob(String(body.stage ?? ""), body.args ?? []);
      json(res, 202, publicJob(job));
      return;
    }

    const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)(\/stream|\/cancel)?$/);
    if (jobMatch) {
      const job = jobs.get(decodeURIComponent(jobMatch[1]));
      if (!job) {
        json(res, 404, { error: "job not found" });
        return;
      }
      if (jobMatch[2] === "/stream" && req.method === "GET") {
        streamJob(req, res, job);
        return;
      }
      if (jobMatch[2] === "/cancel" && req.method === "POST") {
        json(res, 200, { ok: cancelJob(job) });
        return;
      }
      if (!jobMatch[2] && req.method === "GET") {
        json(res, 200, publicJob(job));
        return;
      }
    }

    if (pathname === "/api/action" && req.method === "POST") {
      const body = await readBody(req);
      const id = String(body.id ?? "");
      const action = String(body.action ?? "");
      if (!id) throw new Error("缺少资产 id");
      const map = {
        approve: ["creative", ["review", "--id", id, "--status", "approved"]],
        reject: ["creative", ["review", "--id", id, "--status", "retired"]],
        share: ["creative", ["share", id]],
        review: ["creative", ["scan"]],
        "clean-work": [
          "creative",
          ["clean-work", id, ...(body.force ? ["--force"] : [])],
        ],
      };
      const entry = map[action];
      if (!entry) throw new Error(`不支持的操作：${action}`);
      const job = enqueueJob(entry[0], entry[1]);
      json(res, 202, publicJob(job));
      return;
    }

    if (pathname === "/api/reveal" && req.method === "POST") {
      const body = await readBody(req);
      const target = path.resolve(String(body.path ?? ""));
      if (!inside(OUT, target) && !inside(DATA, target)) {
        json(res, 403, { error: "只允许打开 out/ 或 data/ 下的路径" });
        return;
      }
      if (process.platform === "win32") {
        spawn("explorer.exe", [`/select,${target}`], {
          detached: true,
          stdio: "ignore",
        }).unref();
      } else {
        spawn(process.platform === "darwin" ? "open" : "xdg-open", [
          existsSync(target) && statSync(target).isDirectory()
            ? target
            : path.dirname(target),
        ], { detached: true, stdio: "ignore" }).unref();
      }
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/media/market/icon" && req.method === "GET") {
      try {
        const providerId = url.searchParams.get("provider");
        const prefix = url.searchParams.get("prefix") ?? "";
        const siblings = (url.searchParams.get("names") ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 12);
        if (siblings.length) prefetchIconFiles(cfg, providerId, prefix, siblings);
        const file = await loadIconFile(cfg, {
          providerId,
          prefix,
          name: url.searchParams.get("name") ?? "",
        });
        res.writeHead(200, {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=604800",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(file);
      } catch (error) {
        if (error.pending) {
          res.writeHead(200, {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Market-Pending": "1",
            "X-Content-Type-Options": "nosniff",
          });
          res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
          return;
        }
        text(res, 502, error.message);
      }
      return;
    }

    if (pathname.startsWith("/media/footage/")) {
      const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const id = parts[2] ?? "";
      const library = readJson(path.join(DATA, "library.json"), { assets: [] }).assets ?? [];
      const asset = library.find((item) => item.id === id);
      if (!asset?.source) {
        text(res, 404, "Not found");
        return;
      }
      const file = path.resolve(asset.source);
      const roots = cfg.footage.roots.map((root) => path.resolve(root));
      if (!roots.some((root) => inside(root, file))) {
        text(res, 403, "Forbidden");
        return;
      }
      serveFile(req, res, file);
      return;
    }

    if (pathname.startsWith("/media/assets/")) {
      const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const relative = parts.slice(2).join("/");
      let file = null;
      for (const root of cfg.assetRoots) {
        const candidate = path.join(root, ...relative.split("/"));
        if (
          inside(root, candidate) &&
          existsSync(candidate) &&
          statSync(candidate).isFile()
        ) {
          file = candidate;
          break;
        }
      }
      if (!file) {
        text(res, 404, "Not found");
        return;
      }
      serveFile(req, res, file);
      return;
    }

    if (pathname.startsWith("/media/")) {
      const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const rootName = parts[1];
      const root = rootName === "out" ? OUT : rootName === "data" ? DATA : null;
      if (!root) {
        text(res, 404, "Not found");
        return;
      }
      const file = path.join(root, ...parts.slice(2));
      if (!inside(root, file)) {
        text(res, 403, "Forbidden");
        return;
      }
      serveFile(req, res, file);
      return;
    }

    if (pathname === "/" || pathname === "") {
      serveFile(req, res, path.join(PUBLIC, "index.html"));
      return;
    }
    const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
    const file = path.join(PUBLIC, rel);
    if (!inside(PUBLIC, file)) {
      text(res, 403, "Forbidden");
      return;
    }
    serveFile(req, res, file);
  } catch (error) {
    json(res, 400, { error: error.message });
  }
});

loadJobs();
server.on("error", (error) => {
  console.error(`[workbench] 启动失败：${error.message}`);
  process.exit(1);
});
server.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`[workbench] ${url}`);
  console.log(`[workbench] workspace ${ROOT}`);
  if (OPEN) {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else {
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }
  }
});

process.on("SIGINT", () => {
  if (active?.child) cancelJob(active);
  persistJobs();
  process.exit(0);
});
