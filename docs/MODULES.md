# MODULES

新增或修改模块/preset/引擎/创意工程后更新本表。

## 运行边界与注册校验

- 核心业务在 `modules/`、`src/`、`tools/`、`workbench/`；共享快照在 `common/`；项目内容在 `projects/`。
- `data/`、`out/`、`public/` 是运行时区域，不是核心源码；`public/` 只做 Remotion 静态投影。
- `config/pipeline.json` 是稳定项目策略唯一来源；`config/pipeline.schema.json` 与 `tools/check-config.mjs` 校验字段、beat、引擎/创意、组件和项目 manifest 引用。
- `creative/engines/*/engine.json` 与 `index.tsx` 是引擎的唯一来源；`creative/registry.ts` 由 scan 生成，必须与引擎包一致。
- 工作台参数元数据在 `config/parameters.json`，接口为 `/api/config`、`/api/parameters`、`/api/components`。
- 缓存和迁移：`node run.mjs cache list|clean`、`node run.mjs public [--apply]`；删除和实体目录替换默认 dry-run/拒绝冲突。

| 模块 | 入口 | 职责 | 关键函数 |
|---|---|---|---|
| 扫描 | `modules/scan/index.mjs` | 多根目录扫描、增量、场景切分、缩略图 | `scanAll(cfg)` |
| 目录与渲染 | `modules/generate/catalog.mjs`、`render.mjs` | catalog 条目、props、merge/reindex、MP4/WebM/静帧渲染 | `makeEntry`、`mergeCatalog`、`writeCatalog`、`readCatalog`、`reindexCatalog`、`renderAsset` |
| 创意 | `modules/creative/index.mjs` | 创意工程：scan / validate / plan / build / preview / review / reset | `validateAll`、`compileSelection`、`buildCreatives`、`previewCreatives` |
| 创意参数 | `modules/creative/params.mjs` | 引擎参数 schema 解析、类型/范围/enum 校验 | `resolveParams`、`fieldMap` |
| 作品素材 | `modules/creative/work.mjs` | 按 work seed 从创意变体池选材、应用 variation、构建并渲染 work 素材 | `selectWorkItems`、`buildWorkEntries`、`generateWorkAssets` |
| 变化轴 | `modules/generate/variation.mjs` | 按 work seed 选版式/背景/光色/文案/镜头/转场/节奏 | `pickVariation`、`applyVariation`、`variationDuration` |
| 裂变 | `modules/fission/index.mjs` | 默认用 shared 创意素材库编排；`--with-assets` 时才从创意变体池生成作品专属素材，再调用 `mix --work` | `generateWorkAssets`、`pickVariation`、`spawnSync` |
| 质量 | `modules/quality/index.mjs` | 分析素材、写回 catalog、生成覆盖/相似度报告 | `analyzeEntries`、`buildReport`、`writeReport` |
| 感知指标 | `modules/quality/analyze.mjs` | pHash、alpha、运动、颜色与质量 flags | `analyzeAsset`、`qualityConfig` |
| 相似度 | `modules/quality/similarity.mjs` | 对齐 Hamming、感知簇、覆盖矩阵、近似重复 | `pairMetrics`、`alignedHamming`、`buildReport` |
| 视觉底层 | `modules/lib/vision.mjs` | ffmpeg 抽帧、DCT、pHash、颜色/运动/alpha | `sampleRgb`、`sampleAlpha`、`phashFromGray` |
| 混剪 | `modules/mix/index.mjs` | 按 scope/status/quality 选材、转场原子、规划、校验、静帧、分段、全片 | `planOutput(cfg, ctx)`、`validateEdl`、`addToRegistry` |
| 工作台 | `workbench/server.mjs` | 本地 HTTP 服务：素材/成片/质量浏览、单任务队列、SSE 日志、Range 媒体 | `enqueueJob`、`streamJob`、`listCatalog` |
| 工作台前端 | `workbench/public/*` | 概览、素材、创意、任务、成片、质量六个页面 | `app.js` |
| 公共 | `modules/lib/*.mjs` | 配置、ffmpeg、public 链接、Remotion 封装、RNG | `loadConfig`、`ensurePublicLinks`、`renderVideo`、`makeRng` |

## Preset

| id | 组件 | alpha | 默认图标组 | 用途 |
|---|---|---|---|---|
| `platform-orbit` | `creative/engines/platform-orbit/index.tsx` | 是 | `social` | 品牌图标环绕、聚拢、落位 |
| `social-constellation` | `creative/engines/social-constellation/index.tsx` | 是 | `social` | 图标星座、连线与脉冲 |
| `network-universe` | `creative/engines/network-universe/index.tsx` | 是 | `social` | 点阵世界地图、跨区域连线与光门 |
| `icon-morph` | `creative/engines/icon-morph/index.tsx` | 是 | `messaging` | 图标遮罩擦除式转换（完整循环） |
| `icon-glitch-scatter` | `creative/icon-neon/engine/index.tsx` | 是 | 多平台 | 霓虹/赛博朋克图标散布；单平台故障强调 |
| `ui-mock` | `creative/engines/ui-mock/index.tsx` | 否 | 单平台 | 手机界面示意：短信、通话、账号、注册 |
| `kinetic-grid` | `creative/engines/kinetic-grid/index.tsx` | 是 | `social` | 透视网格与穿越光门 |
| `text-atom` | `creative/text-display/engine/index.tsx` | 是 | 无 | 文字动效原子：T01 / T03 / T06 / T08 |
| `transition-atom` | `creative/transitions/engine/index.tsx` | 是 | 无 | 转场原子：flash / wipe / glitch / light-leak |
| `particle-atom` | `creative/particles/engine/index.tsx` | 是 | 无 | 粒子原子：P01 尘埃 / P04 光球 / P05 流场 |
| `camera-scene` | `creative/camera-moves/engine/index.tsx` | 否 | 继承 basePreset | 镜头包装：C01 推近 / C02 抖动 / C06 快速变焦 / C09 拉远 |

全部引擎默认跟随创意工程放在 `engine/`；被复用的 6 个场景引擎放在 `creative/engines/`。新增或移动后运行 `node run.mjs creative scan --write-registry`。

## Catalog 字段

`data/catalog.json` 的每个条目现在包含：

| 组 | 字段 | 用途 |
|---|---|---|
| 身份 | `id`、`preset`、`engine`、`version` | 追溯来源与版本 |
| 作品 | `scope`、`workId`、`workSeed`、`sharedAt` | work/shared 隔离、缓存与提升 |
| 粒度 | `layer`、`category`、`series`、`seriesIndex`、`sceneCapable`、`overlayCapable`、`transitionCapable` | 决定能被混剪当作什么用；分类见 `docs/ASSETS.md` |
| 审核 | `status`、`approvedAt`、`rejectedAt` | `draft / approved / retired` |
| 规划 | `beatRoles`、`duration`、`durationInFrames`、`alpha`、`loop`、`props` | 节拍匹配与渲染 |
| 创意 | `creativeId`、`variantId`、`creativeVersion`、`variantVersion`、`style`、`paramsHash` | 创意工程出处；参数变化会产生新 ID |
| 追溯 | `source`、`tags`、`labels` | 创意 id / 变体 / code / 参数 hash |
| 质量 | `quality`（pHash / alphaCoverage / motionEnergy / brightness / contrast / avgColor / flags / ok）、`usage` | 感知去重、质量闸门与覆盖报告 |

## 混剪选材规则

- 只消费 `status = approved`；`--allow-draft` 可临时放开。
- 生成镜头：`sceneCapable = true`，且 `beatRoles` 包含当前角色。
- 叠加层：`overlayCapable = true`，使用透明 WebM；时长 ≥ 0.5s。
- 转场：`transitionCapable = true`，按节拍角色匹配，挂到 `shot.transitionAsset`。
- 有转场原子时，CSS `TransitionFx` 不再叠加；叠加层延后到转场结束再开始。
- `mix.maxPerCreative` 限制同一创意工程在单条成片中的使用次数。
- `camera` 引擎的生成镜头在混剪里锁定 `motion: still`，避免二次运镜。
- `particle-*` 与 `platform-icons-neon` 叠加使用 `screen` 混合，避免暗底遮住实拍。
- `quality.ok === false` 的素材默认跳过；`--allow-low-quality` 放开。
- `mix.perceptualDedupe !== false` 时，同一层内不与已用素材观感过近（对齐 Hamming ≤ `quality.clusterDistance`）。
- 节拍与镜头解耦：`planBeats` 按 `beatJitter` 做每作品抖动；`planShotSegments` 用 `shotLength.min/max` 定目标镜头数，合并中间节拍、拆分过长镜头，并让长短交替。
- EDL 的 `beats[]` 是叙事窗口；`beats[].shots[]` 按镜头起点归属，允许空数组。镜头可以跨节拍。

## 音频

- SFX 索引：`creative/shared/audio/sfx.index.json`，13 个 Kenney CC0 音效。
- BGM 索引：`creative/shared/audio/music.index.json`，3 首 AERIS CC0 + 2 首 Kevin MacLeod CC BY；音频文件在素材根 `assets/music`。
- EDL 音频：`audio = { music, sfx[] }`；`beatFrames` 来自选中曲目的 BPM。
- 库内 BGM 用 `music/<file>`（`public/music` 目录链接）；外部音乐复制到 `public/audio`，避免文件符号链接。
- `planner.mjs`：`resolveMusic` 自动选曲；`buildSfx` 按叙事角色、转场、文字叠加和 UI mock 落点。
- `MixVideo.tsx`：音乐角色能量曲线 + SFX ducking；SFX 用独立 `Sequence`。
- 设计规则与来源见 `docs/AUDIO.md`。

## 创意工程

`creative/` 是生成式素材的唯一来源：

- `creative/engines/<engine>/` 只放被 2+ 创意复用的共享引擎：`engine.json` 声明 `preset`、`category`、`layer`、`alpha`、`loop`、`complete`、`styles`、`shared`；`index.tsx` 是 React 实现并导出 `Component`。
- 默认每个创意在 `<creative-id>/engine/` 自带本地实现（`engine.json` + `index.tsx`），`creative.json` 写 `engine: "./engine"`；第二个创意复用时再整体移到 `creative/engines/`。
- `creative/registry.ts` 由 `creative scan --write-registry` 生成，把共享引擎与本地引擎静态注册给 `GeneratedAsset`；`npm run check` 会校验它是否最新。
- `creative/<id>/creative.json` 声明意图、引擎引用、适用实拍条件、默认参数与内容池；`variants/*.json` 用 `items` 描述 1-n 条素材。
- 参数解析：schema 默认值 → `creative.params` → 变体 `params` → item `params`。
- 编译产物强制带 `creativeId / variantId / creativeVersion / variantVersion / style / paramsHash`；ID 为 `<creativeId>-<variantId>-v<index>-<hash>`。
- `build` 会渲染 MP4 + 透明 WebM + 静帧、自动质量分析，并按 `creativeId + variantId` 对账：新 ID 插入，同变体旧 ID 标 `retired`。
- 命令：`node run.mjs creative scan|validate|plan|build|preview|review|share|clean-work|list-works|reset`；工作台页面 `#/creative`。
- 参见 `docs/CREATIVE.md`。

## 裂变与作品素材

- `scope = work | shared`；旧条目缺省为 shared。
- Work 素材 ID 含 workId；不同 work 不会命中同一文件。
- `fission` 从创意变体池按 workSeed 选 scene / overlay / transition，生成后自动 `approved`，但只对所属 work 可见。
- `mix --work <id>` 只使用 shared + 当前 work 素材；没有 work 素材时只用 shared，planner 优先 work-local。
- `mix.requireWorkAsset` 默认 `false`；需要强制使用专属素材时加 `--require-work-asset`。
- `--share` 把 work 素材提升为 shared；`--list-works` 查看；`--clean-work` 默认 dry-run，`--force` 删除。
- 变化轴定义在 `creative/shared/variation.json`，由 `variation.mjs` 按 workSeed 选择；结果写入 catalog `variation` 与 EDL `variation` / `workProfile`。文件缺失时使用内置最小默认值。
- 详见 `docs/FISSION.md`。

## 质量与覆盖

- `creative build` / `fission` 渲染后自动分析本次渲染或缺失 `quality.phash` 的素材；`quality.autoAnalyze = false` 可关闭。
- `node run.mjs quality` 可单独重算/报告；`--force` 重算，`--report-only` 只读。
- 指标写回 catalog `quality`：pHash 帧序列、alpha 覆盖率、运动能量、亮度/对比度、平均色、flags、ok。
- 完整性指标：`firstLastHamming`（循环闭合）、`endMotion`（末帧是否稳定）、`alphaEnd`（转场是否回到透明）；按 `category` 判 `loop-mismatch` / `end-unsettled` / `end-residue`，规则见 `docs/ASSETS.md`。
- 相似度：同层素材按比例对齐帧序列算平均 Hamming，结合颜色得到 score；`clusterDistance` 聚类，`similarityThreshold` 标近似重复。
- 覆盖矩阵：palette × layer、creative × palette、engine × layer、scope × layer；轴覆盖给出取值数、归一化熵与分布。
- 报告：`data/quality/report.json`、`out/quality/report.md`。
- 质量闸门与感知去重细节见 `docs/QUALITY.md`。

## 组件

| 组件 | 位置 | 用途 |
|---|---|---|
| `IconTile` | `creative/shared/parts.tsx` | 白色圆角图标块；白图标自动反相 |
| `Caption` | `creative/shared/parts.tsx` | preset 底部说明文字 |
| `DotGrid` | `creative/shared/parts.tsx` | 点阵背景 |
| `TextAtom` | `creative/text-display/engine/index.tsx` | 文字动效原子 |
| `TransitionAtom` | `creative/transitions/engine/index.tsx` | 转场原子 |
| `ParticleAtom` | `creative/particles/engine/index.tsx` | 粒子原子 |
| `CameraScene` | `creative/camera-moves/engine/index.tsx` | 现有 scene 的镜头包装 |
| `Backdrop` | `creative/shared/backdrop.tsx` | 文本/粒子背景：glow / grid / dots / gradient |
| `easing` | `common/engine/easing.ts` | 确定性缓动函数 |
| `GeneratedAsset` | `src/GeneratedAsset.tsx` | `PipelineAsset` composition 入口 |
| `MixVideo` | `src/MixVideo.tsx` | EDL 时间线；实拍/生成/叠加/转场 |
| `TransitionClip` | `src/MixVideo.tsx` | 播放 `transitionAsset` 透明 WebM |
| `platform.ts` | `src/platform.ts` | 公共层唯一出口：engine |

## 数据流

```text
footage roots
  └─ scan ──> data/footage.manifest.json
              data/library.json
              data/thumbs/
                   │
creative/engines/<engine>/ + creative/<id>/ + creative/registry.ts
  └─ creative build ──> data/catalog.json（shared / status / layer / creativeId）
                  out/assets/*.mp4|webm
                  out/stills/assets/
                       │
                       ├─ fission ──> data/catalog.json（scope=work + workId）
                       │              out/assets/work-*.mp4|webm
                       │              └─ mix --work ──> data/edl/work-*.json
                       │                               out/work-*.mp4
                       │
                       ├─ creative review/share ──> catalog.status/scope
                       │
                       ├─ quality ──> catalog.quality
                       │              data/quality/report.json
                       │              out/quality/report.md
                       │
                       └─ mix ───────> data/edl/mix-*.json（含 transitionAsset / audio）
                                       data/edl/signatures.json
                                       out/stills/<id>/
                                       out/segments/<id>/
                                       out/mix-*.mp4

creative/shared/audio/sfx.index.json
creative/shared/audio/music.index.json
  └─ mix ──> audio = { music, sfx[] }
```

## 公共层

- `common/engine`：设计令牌、运动数学、时间工具、字体门、CanvasStage（不含字体清单）。
- `common/vendor`：motion-core、remotion-kit、camera、backgrounds 等第三方/上游实现。
- `common/vendor/canvas-engine`：逐帧 Canvas 绘制。

`common/` 只剩 `engine/` 与 `vendor/`。素材库 `assets/`（多根合并，二进制 + 清单）属于内容部署、gitignore；镜头卡在 `creative/shared/shots/`。

不要在 `common/` 里加业务逻辑；业务逻辑放 `src/` 与 `modules/`。

## 内容包同步

| 位置 | 作用 |
|---|---|
| `modules/lib/assets.mjs` | 素材库多根：`scanAssetFiles` / `diffAssetFiles` / `findAssetFile` / `sha256` |
| `modules/lib/projects.mjs` | 扫描 `projects/*/project.json`，校验 id、目录、脚本入口 |
| `tools/assets.mjs` | 清单 CLI：`check / scan / fetch / list`（scan 支持 `--apply --prune --check`） |
| `tools/sync.mjs` | 统一同步：注册表 + 素材清单 + 可选实拍（`--apply / --check / --footage`） |
| `tools/projects.mjs` | 项目包 CLI：`scan` |
| `tools/init-creative.mjs` | 注册表缺失时生成空注册表（postinstall） |

`modules/creative/registry.mjs` 同时生成 `PRESETS` 与 `FONT_MANIFEST`：`creative/shared/fonts.ts` 存在则 re-export，否则导出空数组。
