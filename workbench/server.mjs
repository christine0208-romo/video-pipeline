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
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../modules/lib/config.mjs";

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
  "generate",
  "quality",
  "mix",
  "fission",
  "check",
]);

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
  const { child, listeners, logStream, ...rest } = job;
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
  appendLog(job, `\n[job] node run.mjs ${job.stage} ${job.args.join(" ")}\n\n`);

  const child = spawn(
    process.execPath,
    [path.join(ROOT, "run.mjs"), job.stage, ...job.args],
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
  return (catalog.assets ?? []).map((asset) => ({
    id: asset.id,
    preset: asset.preset,
    recipeId: asset.recipeId ?? null,
    engine: asset.engine ?? null,
    layer: asset.layer ?? "scene",
    category: asset.category ?? asset.quality?.category ?? null,
    series: asset.series ?? null,
    seriesIndex: asset.seriesIndex ?? null,
    scope: asset.scope ?? "shared",
    workId: asset.workId ?? null,
    status: asset.status ?? "approved",
    duration: asset.duration,
    alpha: Boolean(asset.alpha),
    loop: Boolean(asset.loop),
    tags: asset.tags ?? {},
    variation: asset.variation ?? null,
    quality: asset.quality ?? null,
    thumb: mediaUrl(asset.stills?.[0]) ?? mediaUrl(asset.fileMp4),
    mp4: mediaUrl(asset.fileMp4),
    webm: mediaUrl(asset.fileWebm),
    stills: (asset.stills ?? []).map(mediaUrl).filter(Boolean),
  }));
}

function listLibrary() {
  const library = readJson(path.join(DATA, "library.json"), { assets: [] });
  return (library.assets ?? []).map((asset) => ({
    id: asset.id,
    name: asset.name ?? path.basename(asset.path ?? ""),
    path: asset.path,
    type: asset.type,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    status: asset.status,
    tags: asset.tags ?? {},
    thumbs: (asset.thumbs ?? []).map(mediaUrl).filter(Boolean),
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
        generate: cfg.generate,
        mix: cfg.mix,
        fission: cfg.fission,
        quality: cfg.quality,
        paths: {
          data: DATA,
          out: OUT,
          public: cfg.paths.public,
          cache: cfg.paths.cache,
          temp: cfg.paths.temp,
          release: cfg.paths.release,
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
      const file = path.join(ROOT, "config", "parameters.json");
      json(res, 200, readJson(file, { version: 1, stages: {} }));
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
    if (pathname === "/api/jobs" && req.method === "GET") {
      json(res, 200, {
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
        approve: ["generate", ["--approve", id]],
        reject: ["generate", ["--reject", id]],
        share: ["generate", ["--share", id]],
        review: ["generate", ["--review"]],
        "clean-work": [
          "generate",
          ["--clean-work", id, ...(body.force ? ["--force"] : [])],
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
