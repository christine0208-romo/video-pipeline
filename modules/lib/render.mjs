import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { PIPELINE_ROOT } from "./config.mjs";

export const CLI = path.join(PIPELINE_ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
export const ENTRY = path.join(PIPELINE_ROOT, "src", "index.ts");
export const CONFIG = path.join(PIPELINE_ROOT, "remotion.config.ts");

export function findBrowser() {
  const explicit = process.env.REMOTION_BROWSER;
  if (explicit && existsSync(explicit)) return explicit;

  const playwright = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  if (existsSync(playwright)) {
    const dirs = readdirSync(playwright)
      .filter((name) => name.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const exe = path.join(
        playwright,
        dir,
        "chrome-headless-shell-win64",
        "chrome-headless-shell.exe",
      );
      if (existsSync(exe)) return exe;
    }
  }

  for (const candidate of [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function propsArg(props) {
  if (!props) return null;
  if (typeof props === "string") {
    return existsSync(props) ? path.resolve(props) : props;
  }
  return JSON.stringify(props);
}

export function remotion(args, { stdio = "inherit" } = {}) {
  if (!existsSync(CLI)) {
    throw new Error(`找不到 Remotion CLI：${CLI}。先在仓库根目录执行 npm install。`);
  }
  const final = [
    CLI,
    ...args,
    `--public-dir=${path.join(PIPELINE_ROOT, "public")}`,
    `--config=${CONFIG}`,
  ];
  const browser = findBrowser();
  if (browser) final.push(`--browser-executable=${browser}`);
  const result = spawnSync(process.execPath, final, {
    cwd: PIPELINE_ROOT,
    stdio,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.slice(-2400);
    throw new Error(`Remotion 失败（退出码 ${result.status}）：\n${detail}`);
  }
  return result;
}

export function renderStill({ composition, frame, out, props }) {
  const args = ["still", ENTRY, composition, out, `--frame=${frame}`];
  const value = propsArg(props);
  if (value) args.push(`--props=${value}`);
  remotion(args);
}

export function renderVideo({
  composition,
  out,
  props,
  frames,
  codec = "h264",
  pixelFormat = "yuv420p",
  imageFormat,
  crf,
  muted,
}) {
  const args = ["render", ENTRY, composition, out, `--codec=${codec}`];
  if (pixelFormat) args.push(`--pixel-format=${pixelFormat}`);
  if (imageFormat) args.push(`--image-format=${imageFormat}`);
  if (crf != null) args.push(`--crf=${crf}`);
  if (frames) args.push(`--frames=${frames}`);
  if (muted) args.push("--muted");
  args.push("--overwrite");
  const value = propsArg(props);
  if (value) args.push(`--props=${value}`);
  remotion(args);
}
