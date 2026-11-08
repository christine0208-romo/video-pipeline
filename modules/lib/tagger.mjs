import { existsSync } from "node:fs";
import path from "node:path";
import { readJson } from "./fsx.mjs";
import { deepMerge } from "./config.mjs";

const PLATFORMS = [
  ["whatsapp", ["whatsapp", "wa business"]],
  ["facebook", ["facebook", "fb"]],
  ["instagram", ["instagram", "reels", "ig"]],
  ["telegram", ["telegram"]],
  ["x", ["twitter", "x-twitter", "推特"]],
  ["youtube", ["youtube"]],
  ["tiktok", ["tiktok", "抖音"]],
  ["wechat", ["wechat", "微信"]],
  ["discord", ["discord"]],
  ["line", ["line app"]],
  ["threads", ["threads"]],
  ["pinterest", ["pinterest"]],
  ["snapchat", ["snapchat"]],
];

const SUBJECTS = [
  ["手机", ["phone", "smartphone", "iphone", "mobile", "手机"]],
  ["SIM卡", ["sim", "sim-card", "电话卡", "sim卡"]],
  ["卡片", ["card", "卡片"]],
  ["包装", ["package", "parcel", "box", "unbox", "包装", "快递"]],
  ["手", ["hand", "hands", "手指", "手"]],
  ["人", ["person", "people", "man", "woman", "girl", "boy", "人"]],
  ["电脑", ["laptop", "macbook", "computer", "电脑"]],
  ["屏幕", ["screen", "display", "interface", "ui", "屏幕", "界面"]],
  ["桌面", ["desk", "table", "workspace", "桌面"]],
  ["城市", ["city", "street", "building", "城市", "街"]],
  ["地图", ["map", "globe", "world", "地图", "地球"]],
  ["证件", ["passport", "id-card", "证件", "护照"]],
  ["耳机", ["headphone", "earphone", "耳机"]],
];

const ACTIONS = [
  ["展示", ["show", "showcase", "display", "demo", "展示"]],
  ["开箱", ["unbox", "unboxing", "开箱"]],
  ["注册", ["signup", "sign-up", "register", "注册"]],
  ["登录", ["login", "signin", "sign-in", "登录"]],
  ["滑动", ["scroll", "swipe", "滑动"]],
  ["输入", ["type", "typing", "input", "输入"]],
  ["点击", ["tap", "click", "点击"]],
  ["通话", ["call", "calling", "通话", "打电话"]],
  ["收码", ["sms", "code", "verification", "验证码", "短信"]],
  ["扫码", ["scan", "qr", "扫码"]],
  ["行走", ["walk", "walking", "行走", "走路"]],
  ["讲述", ["talk", "speaking", "讲述", "口播"]],
];

const MOODS = [
  ["明亮", ["bright", "daylight", "sunny", "明亮"]],
  ["暗调", ["dark", "night", "dim", "暗调", "夜景"]],
  ["暖色", ["warm", "golden", "amber", "暖色"]],
  ["冷色", ["cool", "blue", "cyan", "冷色"]],
  ["干净", ["clean", "minimal", "white", "干净", "极简"]],
  ["科技", ["tech", "cyber", "futuristic", "科技", "未来"]],
];

const SCALES = [
  ["close", ["close", "macro", "detail", "特写", "近景"]],
  ["wide", ["wide", "establish", "全景", "远景", "空镜"]],
];

function hasWord(text, word) {
  if (/[一-鿿]/.test(word) || !/^[a-z0-9][a-z0-9 -]*$/.test(word)) {
    return text.includes(word);
  }
  if (word.length <= 4) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
  }
  return text.includes(word);
}

function collect(text, table) {
  const hits = [];
  for (const [tag, words] of table) {
    if (words.some((word) => hasWord(text, word))) hits.push(tag);
  }
  return hits;
}

const unique = (list) => [...new Set(list.filter(Boolean))];

const sidecarCache = new Map();

function readSidecar(file) {
  if (sidecarCache.has(file)) return sidecarCache.get(file);
  const value = readJson(file, {});
  sidecarCache.set(file, value);
  return value;
}

export function loadHumanTags({ file, root, relPath, id, cfg }) {
  const names = cfg.footage.sidecars ?? ["tags.json"];
  const sources = [];
  for (const name of names) {
    for (const candidate of [path.join(root, name), path.join(path.dirname(file), name)]) {
      if (existsSync(candidate)) sources.push(readSidecar(candidate));
    }
  }
  const globalSidecar = path.join(cfg.paths.data, "human-tags.json");
  if (existsSync(globalSidecar)) sources.push(readSidecar(globalSidecar));

  const keys = [relPath, path.basename(file), id];
  let out = null;
  for (const source of sources) {
    for (const key of keys) {
      if (source && source[key]) out = deepMerge(out, source[key]);
    }
  }
  return out ?? {};
}

export function tagAsset({ relPath, scenes, orientation, human }) {
  const text = relPath.toLowerCase().replace(/[\\/_.\-]+/g, " ");
  const subjects = collect(text, SUBJECTS);
  const actions = collect(text, ACTIONS);
  const moods = collect(text, MOODS);
  const scales = collect(text, SCALES);
  const platforms = PLATFORMS.filter(([, words]) =>
    words.some((word) => hasWord(text, word)),
  ).map(([name]) => name);
  const platform = platforms[0];

  const auto = {
    subjects,
    actions,
    mood: moods,
    shotScale: scales[0] ?? "medium",
    keywords: unique([...subjects, ...actions, ...moods, ...platforms]),
    platform: platform ?? "",
    platforms,
    focus: [0.5, 0.5],
    bestIn: scenes?.[0]?.bestIn ?? 0,
    quality: 0.6,
    hasText: false,
    fit: orientation === "horizontal" ? "contain" : "cover",
    usable: (scenes ?? []).map((scene) => ({ start: scene.start, end: scene.end })),
    notes: "",
    source: "auto",
  };

  if (!human || !Object.keys(human).length) return auto;
  const merged = deepMerge(auto, human);
  merged.source = "human";
  if (!human.usable) merged.usable = auto.usable;
  if (!human.focus) merged.focus = auto.focus;
  return merged;
}
