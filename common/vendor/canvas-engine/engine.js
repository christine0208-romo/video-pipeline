// 画布引擎：只做绘制与排版，不含内容。使用前调用 configureEngine(CONFIG)。
let CONFIG = null;
export let C = null;
export let T = null;
export let S = null;

export function configureEngine(cfg) {
  CONFIG = cfg;
  C = cfg.COLORS;
  T = cfg.TYPE;
  S = cfg.SAFE;
  return cfg;
}

// ---------- 数学 ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (t, a, b) => clamp((t - a) / (b - a));
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
export const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const backOut = (t, s = 1.3) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 基础图形 ----------
export function roundRect(ctx, x, y, w, h, r = 16) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRound(ctx, x, y, w, h, r, color, lw = 1) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const { r = 18, fill = C.surface1, border = C.line, highlight = true, shadow = 0 } = opts;
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.45;
    fillRound(ctx, x, y, w, h, r, fill);
    ctx.restore();
  } else {
    fillRound(ctx, x, y, w, h, r, fill);
  }
  if (border) strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r, border, 1);
  if (highlight) {
    ctx.save();
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + 24);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, 24);
    ctx.restore();
  }
}

export function hairline(ctx, x1, y1, x2, y2, color = C.line, lw = 1, dash = null) {
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash(dash || []);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function withAlpha(color, a) {
  if (color.startsWith('#')) {
    const h = color.slice(1);
    const n = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
  }
  if (color.startsWith('rgba(')) return color.replace(/,[^,]+\)$/, `,${a})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  return color;
}

export function dot(ctx, x, y, r, color, glow = 0) {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r + glow);
    g.addColorStop(0, withAlpha(color, 0.9));
    g.addColorStop(0.35, withAlpha(color, 0.35));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r + glow, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function glow(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- 排版 ----------
export function font(size, weight = 400, family = T.zh) {
  return `${weight} ${size}px ${family}`;
}

export function setText(ctx, size, weight, color, family = T.zh, tracking = null) {
  ctx.font = font(size, weight, family);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = tracking == null ? '0px' : `${tracking}px`;
}

export function measure(ctx, text, size, weight = 400, family = T.zh, tracking = 0) {
  ctx.save();
  ctx.font = font(size, weight, family);
  ctx.letterSpacing = `${tracking}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

// 单行文字。align: left|center|right; baseline: top|middle|alphabetic
export function text(ctx, str, x, y, o = {}) {
  const {
    size = T.body, weight = 500, color = C.text, family = T.zh,
    align = 'left', baseline = 'alphabetic', tracking = 0, alpha = 1,
  } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, size, weight, color, family, tracking);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// 楷线字：只描边，字即线。fillAlpha 给极淡的墨。
export function lineText(ctx, str, x, y, o = {}) {
  const {
    size = T.display, weight = 900, color = C.text, family = T.zh,
    align = 'left', baseline = 'alphabetic', tracking = 0,
    lineWidth = 1.3, fillAlpha = 0.06, alpha = 1,
  } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  setText(ctx, size, weight, color, family, tracking);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  if (fillAlpha > 0) {
    ctx.globalAlpha = alpha * fillAlpha;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.globalAlpha = alpha;
  }
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.strokeText(str, x, y);
  ctx.restore();
}

export function strike(ctx, x, y, w, color = C.warn, lw = 3) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

export function monoLabel(ctx, str, x, y, o = {}) {
  return text(ctx, str, x, y, {
    size: o.size || 20, weight: o.weight || 600, color: o.color || C.text3,
    family: T.mono, align: o.align || 'left', baseline: o.baseline || 'alphabetic',
    tracking: o.tracking == null ? 4.2 : o.tracking, alpha: o.alpha ?? 1,
  });
}

// ---------- 背景 ----------
export function background(ctx, opts = {}) {
  const { glowX = 0.62, glowY = 0.28, grid = true, gridAlpha = 1 } = opts;
  ctx.fillStyle = C.bg0;
  ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

  const g = ctx.createRadialGradient(
    CONFIG.W * glowX, CONFIG.H * glowY, 40,
    CONFIG.W * glowX, CONFIG.H * glowY, 1150
  );
  g.addColorStop(0, 'rgba(26,68,120,0.42)');
  g.addColorStop(0.45, 'rgba(12,32,58,0.30)');
  g.addColorStop(1, 'rgba(4,7,12,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

  if (grid) drawGrid(ctx, gridAlpha);

  // 背景软水印：大号印章，低透明度，压在内容之下
  if (logoImg) logoSeal(ctx, CONFIG.W / 2 - 360, 820, 720, 0.018, -0.12);

  const v = ctx.createRadialGradient(540, 900, 380, 540, 960, 1280);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
}

function drawGrid(ctx, alpha = 1) {
  const m = CONFIG.GRID.module;
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = 0, x = 0; x <= CONFIG.W; i++, x += m) {
    if (i % 4 === 0) { ctx.strokeStyle = `rgba(255,255,255,${CONFIG.GRID.major * alpha})`; }
    else { ctx.strokeStyle = `rgba(255,255,255,${CONFIG.GRID.minor * alpha})`; }
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, CONFIG.H); ctx.stroke();
  }
  for (let i = 0, y = 0; y <= CONFIG.H; i++, y += m) {
    if (i % 4 === 0) { ctx.strokeStyle = `rgba(255,255,255,${CONFIG.GRID.major * alpha})`; }
    else { ctx.strokeStyle = `rgba(255,255,255,${CONFIG.GRID.minor * alpha})`; }
    ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(CONFIG.W, Math.round(y) + 0.5); ctx.stroke();
  }
  ctx.restore();
}

// 柔光带：L42 的 light reveal
export function lightBand(ctx, x, y, w, h, angle, alpha = 0.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, 'rgba(140,200,255,0)');
  g.addColorStop(0.5, `rgba(170,220,255,${alpha})`);
  g.addColorStop(1, 'rgba(140,200,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- 图标 ----------
const iconCache = new Map();
let iconImages = {};

export function setIcons(map) { iconImages = map; iconCache.clear(); }

let logoImg = null;
export function setLogo(img) { logoImg = img; }

export function logoSeal(ctx, x, y, size, alpha = 1, rotate = 0) {
  if (!logoImg) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x + size / 2, y + size / 2);
  if (rotate) ctx.rotate(rotate);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.47, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logoImg, -size * 0.53, -size * 0.53, size * 1.06, size * 1.06);
  ctx.restore();
}

export function iconCanvas(name, color, size) {
  const key = `${name}|${color}|${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const img = iconImages[name];
  if (!img) return null;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, size, size);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  iconCache.set(key, cv);
  return cv;
}

export function icon(ctx, name, x, y, size, color, alpha = 1) {
  const cv = iconCanvas(name, color, Math.max(8, Math.round(size)));
  if (!cv) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(cv, x, y, size, size);
  ctx.restore();
}

// ---------- 地图 ----------
let mapDots = null;
export function setMap(data) { mapDots = data; }

export function drawMap(ctx, x, y, w, h, color = 'rgba(120,160,205,0.34)', size = 2.1, progress = 1) {
  if (!mapDots) return;
  const sx = w / mapDots.w, sy = h / mapDots.h;
  const edge = mapDots.w * progress;
  ctx.save();
  ctx.fillStyle = color;
  for (const [px, py] of mapDots.dots) {
    if (px > edge) continue;
    ctx.fillRect(x + px * sx, y + py * sy, size, size);
  }
  ctx.restore();
}

// 两点之间的弧线
export function arc(ctx, x1, y1, x2, y2, bend, color, lw = 1.6, dash = null, alpha = 1) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = mx + nx * bend, cy = my + ny * bend;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ---------- 页面固定元素 ----------
export function rail(ctx, sceneIndex, progress = 0) {
  const y = 118;
  const copy = CONFIG.rail || { left: 'ACCOUNT ENVIRONMENT', right: '' };
  const total = (CONFIG.SCENES || []).length || 11;
  hairline(ctx, S.left, y, S.right, y, 'rgba(255,255,255,0.10)', 1);
  // 进度段
  ctx.fillStyle = C.warn;
  ctx.fillRect(S.left, y - 1, (S.right - S.left) * clamp(progress), 2);
  monoLabel(ctx, copy.left, S.left + 42, y - 18, { size: 17, color: C.text3, tracking: 3.6 });
  logoSeal(ctx, S.left, y - 34, 30, 0.95);
  monoLabel(ctx, copy.right, S.right, y - 18, { size: 17, color: C.text3, tracking: 2.6, align: 'right' });
  monoLabel(ctx, String(sceneIndex).padStart(2, '0') + ' / ' + total, S.right, y + 34, { size: 17, color: C.text3, tracking: 3, align: 'right' });
}

// ---------- 通用场景动作（作品分镜直接复用，不要另起名字） ----------
export function beat(t, at, d = 0.45) {
  return easeOutQuint(clamp((t - at) / d));
}

export function fadeIn(ctx, p, dy, fn) {
  if (p <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= clamp(p);
  ctx.translate(0, (1 - clamp(p)) * dy);
  fn();
  ctx.restore();
}

export function pop(ctx, cx, cy, p, fn) {
  if (p <= 0.001) return;
  const q = clamp(p);
  const s = 0.92 + 0.08 * q;
  ctx.save();
  ctx.globalAlpha *= q;
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

export function wipe(ctx, x, y, w, h, p, fn) {
  if (p <= 0.001) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, Math.max(0, w * clamp(p)), h);
  ctx.clip();
  fn();
  ctx.restore();
}

export function scrim(ctx, y, h, from = 0.92) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(4,7,12,0)');
  g.addColorStop(1, `rgba(4,7,12,${from})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, CONFIG.W, h);
}

export function sectionHead(ctx, kicker, p = 1, y = 236) {
  ctx.save();
  ctx.globalAlpha *= clamp(p);
  monoLabel(ctx, kicker, S.left, y, { size: 19, color: C.text2, tracking: 3.4 });
  hairline(ctx, S.left, y + 18, S.left + (S.right - S.left) * clamp(p), y + 18, C.line);
  ctx.fillStyle = C.accent;
  ctx.fillRect(S.left, y + 17, 34, 2);
  ctx.restore();
}

export function chip(ctx, x, y, w, h, label, o = {}) {
  const {
    color = C.text2, border = C.line, fill = 'rgba(255,255,255,0.03)',
    size = 24, iconName = null, iconSize = 22, strikeThrough = false, strikeP = 0, alpha = 1,
  } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
  fillRound(ctx, x, y, w, h, h / 2, fill);
  strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2, border, 1);
  let tx = x + 18;
  if (iconName) {
    icon(ctx, iconName, x + 14, y + (h - iconSize) / 2, iconSize, color, 0.85);
    tx = x + 14 + iconSize + 10;
  }
  text(ctx, label, tx, y + h / 2, { size, weight: 500, color, baseline: 'middle' });
  if (strikeThrough && strikeP > 0) {
    const tw = measure(ctx, label, size, 500, T.zh, 0);
    strike(ctx, tx - 4, y + h / 2, (tw + 8) * clamp(strikeP), C.warn, 2);
  }
  ctx.restore();
}
