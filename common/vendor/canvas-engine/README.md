# Canvas 引擎

## 使用

```js
import { configureEngine } from '/common/engine/engine.js';
import { CONFIG } from './config.js';

configureEngine(CONFIG);
```

`configureEngine` 会设置 `C`（颜色）、`T`（字体）、`S`（安全区）；之后所有绘制函数可用。

## 主要函数

| 函数 | 用途 |
|---|---|
| `background(ctx, opts)` | 底色、径向光、网格、logo 软水印、暗角 |
| `panel`, `fillRound`, `strokeRound` | 深色 UI 面板 |
| `text`, `lineText`, `monoLabel` | 实心字、描边字、等宽标签 |
| `hairline`, `dot`, `glow`, `lightBand` | 线、点、光、扫描带 |
| `icon(ctx, name, x, y, size, color)` | 公共图标 |
| `drawMap(ctx, x, y, w, h, color, size, progress)` | 点阵世界地图 |
| `arc` | 地图连线 |
| `rail(ctx, index, progress)` | 顶部栏目/进度/页码/印章 |
| `logoSeal(ctx, x, y, size, alpha, rotate)` | 圆形 logo 印章 |
| `rng(seed)` | 确定性随机 |

## 转场

转场不在引擎里，在作品 `main.js` 的 `drawScene`：旧画面压暗，新画面用 `SCENES[i].seed` 的圆角矩形裁切展开。

## 注意

- `background` 会读取 `CONFIG` 与 `setLogo` 的 logo；先 `configureEngine`、`setLogo` 再绘制。
- 任意帧可 seek；不要在绘制函数里用 `Date.now`、无种子随机或累计状态。
