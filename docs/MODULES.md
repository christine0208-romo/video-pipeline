# MODULES

新增或修改模块/preset/recipe 后更新本表。

## 运行边界与注册校验

- 核心业务在 `modules/`、`src/`、`tools/`、`workbench/`；共享快照在 `common/`；项目内容在 `projects/`。
- `data/`、`out/`、`public/` 是运行时区域，不是核心源码；`public/` 只做 Remotion 静态投影。
- `config/pipeline.json` 是稳定项目策略唯一来源；`config/pipeline.schema.json` 与 `tools/check-config.mjs` 校验字段、beat、preset/recipe、组件和项目 manifest 引用。
- `src/generated/presets.json` / `registry.ts` / `recipes.json` 保留不同语义，但必须通过交叉检查；不要手工新增孤立 id。
- 工作台参数元数据在 `config/parameters.json`，接口为 `/api/config`、`/api/parameters`、`/api/components`。
- 缓存和迁移：`node run.mjs cache list|clean`、`node run.mjs public [--apply]`；删除和实体目录替换默认 dry-run/拒绝冲突。

| 模块 | 入口 | 职责 | 关键函数 |
|---|---|---|---|
| 扫描 | `modules/scan/index.mjs` | 多根目录扫描、增量、打标、场景切分、缩略图 | `scanAll(cfg)` |
| 生成 | `modules/generate/index.mjs` | 构建目录、preset/recipe 展开、渲染 MP4/WebM、缓存、静帧、审核 | `buildCatalog(cfg)`、`mergeCatalog`、`writeCatalog`、`readCatalog`、`reviewCatalog` |
| 配方 | `modules/generate/recipes.mjs` | 读取/校验 recipe，展开变体参数与节拍角色 | `readRecipes`、`selectRecipes`、`recipeProps`、`recipeBeatRoles` |
| 作品素材 | `modules/generate/work.mjs` | 按 work seed 从 recipe pool 选材、参数抖动、构建并渲染 work 素材 | `selectWorkRecipes`、`buildWorkEntries`、`generateWorkAssets` |
| 变化轴 | `modules/generate/variation.mjs` | 按 work seed 选版式/背景/光色/文案/镜头/转场/节奏/素材主题 | `pickVariation`、`applyVariation`、`variationDuration` |
| 裂变 | `modules/fission/index.mjs` | 默认用 shared 素材库编排；`--with-assets` 时才生成作品专属素材，再调用 `mix --work` | `generateWorkAssets`、`pickVariation`、`spawnSync` |
| 质量 | `modules/quality/index.mjs` | 分析素材、写回 catalog、生成覆盖/相似度报告 | `analyzeEntries`、`buildReport`、`writeReport` |
| 感知指标 | `modules/quality/analyze.mjs` | pHash、alpha、运动、颜色与质量 flags | `analyzeAsset`、`qualityConfig` |
| 相似度 | `modules/quality/similarity.mjs` | 对齐 Hamming、感知簇、覆盖矩阵、近似重复 | `pairMetrics`、`alignedHamming`、`buildReport` |
| 视觉底层 | `modules/lib/vision.mjs` | ffmpeg 抽帧、DCT、pHash、颜色/运动/alpha | `sampleRgb`、`sampleAlpha`、`phashFromGray` |
| 混剪 | `modules/mix/index.mjs` | 按 scope/status/quality 选材、转场原子、规划、校验、静帧、分段、全片 | `planOutput(cfg, ctx)`、`validateEdl`、`addToRegistry` |
| 工作台 | `workbench/server.mjs` | 本地 HTTP 服务：素材/成片/质量浏览、单任务队列、SSE 日志、Range 媒体 | `enqueueJob`、`streamJob`、`listCatalog` |
| 工作台前端 | `workbench/public/*` | 概览、素材、任务、成片、质量五个页面 | `app.js` |
| 公共 | `modules/lib/*.mjs` | 配置、ffmpeg、public 链接、Remotion 封装、RNG | `loadConfig`、`ensurePublicLinks`、`renderVideo`、`makeRng` |

## Preset

| id | 组件 | alpha | 默认图标组 | 用途 |
|---|---|---|---|---|
| `platform-orbit` | `presets/platform-orbit.tsx` | 是 | `social` | 品牌图标环绕、聚拢、落位 |
| `social-constellation` | `presets/social-constellation.tsx` | 是 | `social` | 图标星座、连线与脉冲 |
| `network-universe` | `presets/network-universe.tsx` | 是 | `social` | 点阵世界地图、跨区域连线与光门 |
| `icon-morph` | `presets/icon-morph.tsx` | 是 | `messaging` | 图标遮罩擦除式转换（完整循环） |
| `icon-glitch-scatter` | `presets/icon-glitch-scatter.tsx` | 是 | 多平台 | 霓虹/赛博朋克图标散布；单平台故障强调 |
| `ui-mock` | `presets/ui-mock.tsx` | 否 | 单平台 | 手机界面示意：短信、通话、账号、注册 |
| `kinetic-grid` | `presets/kinetic-grid.tsx` | 是 | `social` | 透视网格与穿越光门 |
| `text-atom` | `atoms/text-atom.tsx` | 是 | 无 | 文字动效原子：T01 / T03 / T06 / T08 |
| `transition-atom` | `atoms/transition-atom.tsx` | 是 | 无 | 转场原子：flash / wipe / glitch / light-leak |
| `particle-atom` | `atoms/particle-atom.tsx` | 是 | 无 | 粒子原子：P01 尘埃 / P04 光球 / P05 流场 |
| `camera-scene` | `atoms/camera-scene.tsx` | 否 | 继承 basePreset | 镜头包装：C01 推近 / C02 抖动 / C06 快速变焦 / C09 拉远 |

`text-atom`、`transition-atom`、`particle-atom`、`camera-scene` 不直接写进 `generate.presets`；它们由 recipe 提供 props。

## Recipe

配方定义在 `src/generated/recipes.json`。`generate.recipes` 控制本次展开哪些 recipe。

| id | code | layer | 时长 | 可插入节拍 | 说明 |
|---|---|---|---|---|---|
| `text-char-rise` | T01 | overlay | 48f | hook / proof / close | 逐字上浮 |
| `text-typewriter` | T03 | overlay | 54f | build / proof | 打字机 |
| `text-keyword` | T06 | overlay | 45f | hook / proof / turn | 关键词高亮 |
| `platform-icons-neon` | I01 | overlay | 90f | 全部 | 霓虹多平台图标散布；基础 + 6 个单平台故障变体 |
| `platform-icons-neon-global` | I02 | overlay | 90f | 全部 | ChatGPT / Instagram / Facebook / Telegram / X / WhatsApp；故障 0.4s，逐词踩点 |
| `transition-flash` | X01 | transition | 10f | 全部 | 落拍闪白 |
| `transition-wipe` | X02 | transition | 14f | build / proof / turn | 斜切擦除 |
| `transition-glitch` | X08 | transition | 12f | turn / build | 故障切 |
| `transition-light-leak` | X10 | transition | 16f | hook / close / turn | 光漏闪过 |
| `particle-dust` | P01 | overlay | 90f | hook / build / proof / close | 漂浮尘埃 |
| `particle-orbs` | P04 | overlay | 90f | hook / build / proof / close | 流体光球 |
| `camera-push` | C01 | scene | 90f | hook / build / proof / close | 缓慢推近 |
| `camera-shake` | C02 | scene | 90f | hook / turn / close | 冲击抖动 |
| `camera-zoom` | C06 | scene | 90f | hook / turn / build | 快速变焦 |
| `camera-pull` | C09 | scene | 90f | build / proof / close | 拉远见全局 |

T08 数字滚动 / P05 噪声流场于 2026-11-09 禁用（`disabled: true`，定义保留在 `recipes.json` 供未来重做）；现有对应素材已退役。recipe 素材的 `series` 默认等于 recipe id，preset 素材默认等于 preset id，变体用 `seriesIndex` 区分。

`platform-icons-neon` 是第一个霓虹/赛博朋克系列：`seriesIndex` 0 为基础散布，1..6 依次为 WhatsApp / Telegram / WeChat / LINE / Discord / Instagram；故障爆发固定在第 30 帧（1.0s），方便对齐 BGM 或文案节拍。色板为 `cyber`。

`platform-icons-neon-global` 是同一组件的全球平台版：1..6 为 ChatGPT / Instagram / Facebook / Telegram / X / WhatsApp，故障在第 12 帧（0.4s），用于 SIM 卡推广片的逐词踩点；图标使用平台品牌色/渐变，不再统一白色。

## Catalog 字段

`data/catalog.json` 的每个条目现在包含：

| 组 | 字段 | 用途 |
|---|---|---|
| 身份 | `id`、`preset`、`recipeId`、`engine`、`version` | 追溯来源与版本 |
| 作品 | `scope`、`workId`、`workSeed`、`sharedAt` | work/shared 隔离、缓存与提升 |
| 粒度 | `layer`、`category`、`series`、`seriesIndex`、`sceneCapable`、`overlayCapable`、`transitionCapable` | 决定能被混剪当作什么用；分类见 `docs/ASSETS.md` |
| 审核 | `status`、`approvedAt`、`rejectedAt` | `draft / approved / retired` |
| 规划 | `beatRoles`、`duration`、`durationInFrames`、`alpha`、`loop`、`props` | 节拍匹配与渲染 |
| 追溯 | `source`、`tags`、`labels` | prompt / code / recipe 来源 |
| 质量 | `quality`（pHash / alphaCoverage / motionEnergy / brightness / contrast / avgColor / flags / ok）、`usage` | 感知去重、质量闸门与覆盖报告 |

## 混剪选材规则

- 只消费 `status = approved`；`--allow-draft` 可临时放开。
- 生成镜头：`sceneCapable = true`，且 `beatRoles` 包含当前角色。
- 叠加层：`overlayCapable = true`，使用透明 WebM；时长 ≥ 0.5s。
- 转场：`transitionCapable = true`，按节拍角色匹配，挂到 `shot.transitionAsset`。
- 有转场原子时，CSS `TransitionFx` 不再叠加；叠加层延后到转场结束再开始。
- `mix.maxPerRecipe` 限制同一 recipe 在单条成片中的使用次数。
- `camera` 引擎的生成镜头在混剪里锁定 `motion: still`，避免二次运镜。
- `particle-*` 与 `platform-icons-neon` 叠加使用 `screen` 混合，避免暗底遮住实拍。
- `quality.ok === false` 的素材默认跳过；`--allow-low-quality` 放开。
- `mix.perceptualDedupe !== false` 时，同一层内不与已用素材观感过近（对齐 Hamming ≤ `quality.clusterDistance`）。
- 节拍与镜头解耦：`planBeats` 按 `beatJitter` 做每作品抖动；`planShotSegments` 用 `shotLength.min/max` 定目标镜头数，合并中间节拍、拆分过长镜头，并让长短交替。
- EDL 的 `beats[]` 是叙事窗口；`beats[].shots[]` 按镜头起点归属，允许空数组。镜头可以跨节拍。

## 音频

- SFX 索引：`common/assets/sfx/index.json`，13 个 Kenney CC0 音效。
- BGM 索引：`common/assets/music/index.json`，3 首 AERIS CC0 + 2 首 Kevin MacLeod CC BY。
- EDL 音频：`audio = { music, sfx[] }`；`beatFrames` 来自选中曲目的 BPM。
- 库内 BGM 用 `music/<file>`（`public/music` 目录链接）；外部音乐复制到 `public/audio`，避免文件符号链接。
- `planner.mjs`：`resolveMusic` 自动选曲；`buildSfx` 按叙事角色、转场、文字叠加和 UI mock 落点。
- `MixVideo.tsx`：音乐角色能量曲线 + SFX ducking；SFX 用独立 `Sequence`。
- 设计规则与来源见 `docs/AUDIO.md`。

## 裂变与作品素材

- `scope = work | shared`；旧条目缺省为 shared。
- Work 素材 ID 含 workId；不同 work 不会命中同一文件。
- `fission` 从完整 recipe pool 按 workSeed 选 scene / overlay / transition，生成后自动 `approved`，但只对所属 work 可见。
- `mix --work <id>` 只使用 shared + 当前 work 素材；没有 work 素材时只用 shared，planner 优先 work-local。
- `mix.requireWorkAsset` 默认 `false`；需要强制使用专属素材时加 `--require-work-asset`。
- `--share` 把 work 素材提升为 shared；`--list-works` 查看；`--clean-work` 默认 dry-run，`--force` 删除。
- 变化轴定义在 `src/generated/variation.json`，由 `variation.mjs` 按 workSeed 选择；结果写入 catalog `variation` 与 EDL `variation` / `workProfile`。
- 详见 `docs/FISSION.md`。

## 质量与覆盖

- `generate` / `fission` 渲染后自动分析本次渲染或缺失 `quality.phash` 的素材；`quality.autoAnalyze = false` 可关闭。
- `node run.mjs quality` 可单独重算/报告；`--force` 重算，`--report-only` 只读。
- 指标写回 catalog `quality`：pHash 帧序列、alpha 覆盖率、运动能量、亮度/对比度、平均色、flags、ok。
- 完整性指标：`firstLastHamming`（循环闭合）、`endMotion`（末帧是否稳定）、`alphaEnd`（转场是否回到透明）；按 `category` 判 `loop-mismatch` / `end-unsettled` / `end-residue`，规则见 `docs/ASSETS.md`。
- 相似度：同层素材按比例对齐帧序列算平均 Hamming，结合颜色得到 score；`clusterDistance` 聚类，`similarityThreshold` 标近似重复。
- 覆盖矩阵：palette × layer、recipe × palette、engine × layer、scope × layer；轴覆盖给出取值数、归一化熵与分布。
- 报告：`data/quality/report.json`、`out/quality/report.md`。
- 质量闸门与感知去重细节见 `docs/QUALITY.md`。

## 组件

| 组件 | 位置 | 用途 |
|---|---|---|
| `IconTile` | `src/generated/parts.tsx` | 白色圆角图标块；白图标自动反相 |
| `Caption` | `src/generated/parts.tsx` | preset 底部说明文字 |
| `DotGrid` | `src/generated/parts.tsx` | 点阵背景 |
| `TextAtom` | `src/generated/atoms/text-atom.tsx` | 文字动效原子 |
| `TransitionAtom` | `src/generated/atoms/transition-atom.tsx` | 转场原子 |
| `ParticleAtom` | `src/generated/atoms/particle-atom.tsx` | 粒子原子 |
| `CameraScene` | `src/generated/atoms/camera-scene.tsx` | 现有 scene 的镜头包装 |
| `Backdrop` | `src/generated/atoms/backdrop.tsx` | 文本/粒子背景：glow / grid / dots / gradient |
| `easing` | `src/generated/atoms/easing.ts` | 确定性缓动函数 |
| `GeneratedAsset` | `src/GeneratedAsset.tsx` | `PipelineAsset` composition 入口 |
| `MixVideo` | `src/MixVideo.tsx` | EDL 时间线；实拍/生成/叠加/转场 |
| `TransitionClip` | `src/MixVideo.tsx` | 播放 `transitionAsset` 透明 WebM |
| `platform.ts` | `src/platform.ts` | 公共层唯一出口：engine + GeneratedClip |

## 数据流

```text
footage roots
  └─ scan ──> data/footage.manifest.json
              data/library.json
              data/thumbs/
                   │
src/generated/recipes.json
  └─ generate ──> data/catalog.json（shared / status / layer / recipeId）
                  out/assets/*.mp4|webm
                  out/stills/assets/
                       │
                       ├─ fission ──> data/catalog.json（scope=work + workId）
                       │              out/assets/work-*.mp4|webm
                       │              └─ mix --work ──> data/edl/work-*.json
                       │                               out/work-*.mp4
                       │
                       ├─ review --approve/--reject/--share ──> catalog.status/scope
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

common/assets/sfx/index.json
common/assets/music/index.json
  └─ mix ──> audio = { music, sfx[] }
```

## 公共层

- `common/engine`：设计令牌、运动数学、时间工具、字体门、CanvasStage。
- `common/components/reel/v2`：`GeneratedClip`、媒体层、EDL 类型。
- `common/vendor/fy-implementations`：motion-core、remotion-kit、camera、backgrounds 等。
- `common/vendor/canvas-engine`：逐帧 Canvas 绘制。
- `common/assets`：图标、字体、地图、音乐、品牌。
- `common/shots`：124 张镜头卡（方法文档）。

不要在 `common/` 里加业务逻辑；业务逻辑放 `src/` 与 `modules/`。
