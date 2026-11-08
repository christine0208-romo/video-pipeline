# MODULES

新增或修改模块/preset 后更新本表。

## 模块

| 模块 | 入口 | 职责 | 关键函数 |
|---|---|---|---|
| 扫描 | `modules/scan/index.mjs` | 多根目录扫描、增量、打标、场景切分、缩略图 | `scanAll(cfg)` |
| 生成 | `modules/generate/index.mjs` | 构建目录、渲染 MP4/WebM、缓存、静帧 | `buildCatalog(cfg)`、`writeCatalog`、`readCatalog` |
| 混剪 | `modules/mix/index.mjs` | 规划、校验、静帧、分段、全片 | `planOutput(cfg, ctx)`、`validateEdl`、`addToRegistry` |
| 公共 | `modules/lib/*.mjs` | 配置、ffmpeg、public 链接、Remotion 封装 | `loadConfig`、`ensurePublicLinks`、`renderVideo` |

## Preset

| id | 组件 | alpha | 默认图标组 | 用途 |
|---|---|---|---|---|
| `platform-orbit` | `presets/platform-orbit.tsx` | 是 | `social` | 品牌图标环绕、聚拢、落位 |
| `social-constellation` | `presets/social-constellation.tsx` | 是 | `social` | 图标星座、连线与脉冲 |
| `network-universe` | `presets/network-universe.tsx` | 是 | `social` | 点阵世界地图、跨区域连线与光门 |
| `icon-morph` | `presets/icon-morph.tsx` | 是 | `messaging` | 图标遮罩擦除式转换 |
| `ui-mock` | `presets/ui-mock.tsx` | 否 | 单平台 | 手机界面示意：短信、通话、账号、注册 |
| `kinetic-grid` | `presets/kinetic-grid.tsx` | 是 | `social` | 透视网格与穿越光门 |

## 组件

| 组件 | 位置 | 用途 |
|---|---|---|
| `IconTile` | `src/generated/parts.tsx` | 白色圆角图标块；白图标自动反相 |
| `Caption` | `src/generated/parts.tsx` | preset 底部说明文字 |
| `DotGrid` | `src/generated/parts.tsx` | 点阵背景 |
| `GeneratedAsset` | `src/GeneratedAsset.tsx` | `PipelineAsset` composition 入口 |
| `MixVideo` | `src/MixVideo.tsx` | EDL 时间线；实拍/生成/叠加/转场 |
| `platform.ts` | `src/platform.ts` | 公共层唯一出口：engine + GeneratedClip |

## 数据流

```text
footage roots
  └─ scan ──> data/footage.manifest.json
              data/library.json
              data/thumbs/
                   │
                   ├─ generate ──> data/catalog.json
                   │               out/assets/*.mp4|webm
                   │               out/stills/assets/
                   │
                   └─ mix ───────> data/edl/mix-*.json
                                   data/edl/signatures.json
                                   out/stills/<id>/
                                   out/segments/<id>/
                                   out/mix-*.mp4
```

## 公共层

- `common/engine`：设计令牌、运动数学、时间工具、字体门、CanvasStage。
- `common/components/reel/v2`：`GeneratedClip`、媒体层、EDL 类型。
- `common/vendor/fy-implementations`：motion-core、remotion-kit、camera、backgrounds 等。
- `common/vendor/canvas-engine`：逐帧 Canvas 绘制。
- `common/assets`：图标、字体、地图、音乐、品牌。
- `common/shots`：124 张镜头卡（方法文档）。

不要在 `common/` 里加业务逻辑；业务逻辑放 `src/` 与 `modules/`。
