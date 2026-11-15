# ASSETS · 生成式素材规范（进行中）

生成式素材不是主画面，是配合实拍素材的**辅助层**：降低重复度、补足节奏、美化画面。它不能冒充实拍，也不能只做“看起来会动”的半成品。

## 1. 定位

| 原则 | 含义 |
|---|---|
| 辅助而非替代 | 主叙事由实拍承担；生成素材用于叠加、转场、强调、串场 |
| 完整而非炫技 | 每段动画必须有明确的开始、过程和结束；不能在半个图标、半个 loading 上截断 |
| 可组合 | 透明背景、明确图层、可预测的时长与入/出状态，方便和文字、BGM、转场踩点 |
| 可复用 | 通过 category / series / variation 组合扩大覆盖面，不靠无限新增文件 |

## 2. 分类（暂定）

`category` 字段；UI 用中文展示，内部保留英文 id。

| id | 中文 | 说明 |
|---|---|---|
| `text` | 文字 | 透明背景文字动效；结束时应完整可读 |
| `icon` | 图标 | 平台图标展示、切换、聚散；结束时图标必须完整 |
| `transition` | 转场 | 完整过场；结束时通常回到透明，让实拍继续 |
| `particle` | 粒子 | 尘埃、光球、流场；优先可无缝循环 |
| `camera` | 镜头 | 对现有 scene 的运镜包装；不要在混剪里二次运镜 |
| `ui` | 界面示意 | 手机界面等示意画面，必须带「示意」标记 |
| `graphic` | 图形 | 网格、光门、抽象背景 |
| `scene` | 场景 | 完整生成场景，不依赖实拍 |

`series` / `seriesIndex` 为可选字段，用于同一系列的分段/踩点素材；当前只有 `icon-morph` 标记为 `platform-icons`。

## 3. 完整性契约

质量模块（`node run.mjs quality`）会计算：

| 指标 | 含义 |
|---|---|
| `firstLastHamming` | 首帧与末帧 pHash 的 Hamming 距离；越小越接近闭环 |
| `endMotion` | 最后两帧的平均亮度差；越大说明末帧还在运动 |
| `alphaEnd` | 末帧 alpha 覆盖率；转场应接近 0 |

按类型检查：

| 类型 | 要求 | 标记 |
|---|---|---|
| 循环类（`loop = true`） | 首尾帧视觉闭合 | `loop-mismatch`（阻塞） |
| 文字 | 末帧稳定、完整可读（默认 `complete = hold`） | `end-unsettled`（警告） |
| 图标 / 其他 | 显式 `complete = hold` 时检查末帧稳定 | `end-unsettled`（警告） |
| 转场 | 显式 `complete = clear` 时检查末帧回到透明 | `end-residue`（警告） |
| 透明叠加 | alpha 不为空、不过淡 | `empty-alpha` / `faint-alpha` |

`complete` 是可选字段：`hold`（末帧保持完整）、`clear`（末帧回到透明/空）、`loop`（首尾闭合）。未声明时只做通用指标，不强行判定。

阈值在 `config/pipeline.json` 的 `quality`：`loopDistance`、`settleMotion`、`clearAlpha`。

`icon-morph` 已按“完整循环”修正：每个图标的擦除在单个 step 内完成，最后 18% 时间保持完整图标；首尾帧对齐，质量检查通过。

## 4. 系列与踩点（方向，待设计细化）

目标是让生成素材可以配合 BGM、文案、文字展示做踩点，而不是整段随机播放。

以已实现的 `platform-icons-neon` 为例：

```text
platform-icons-neon #0   多平台图标散布（基础，无故障）
platform-icons-neon #1   WhatsApp 图标故障爆发
platform-icons-neon #2   Telegram 图标故障爆发
platform-icons-neon #3   WeChat 图标故障爆发
platform-icons-neon #4   LINE 图标故障爆发
platform-icons-neon #5   Discord 图标故障爆发
platform-icons-neon #6   Instagram 图标故障爆发
```

- 类型：overlay / icon / shared；alpha 透明；3 秒；混剪时以 `screen` 混合，暗底不会遮住实拍。
- 风格：`cyber` 霓虹色板、透视网格、扫描线、图标深度（缩放/模糊/透明度）。
- 图标使用平台品牌色：WhatsApp 绿、Telegram 蓝、Facebook 蓝、Instagram 渐变、X 白、ChatGPT 青绿；不再统一成一种霓虹色。
- 每个 accent 只让一个平台图标在 **第 30 帧（1.0s）** 爆发故障：RGB 色散、切片、冲击环；其余图标保持稳定。
- 基础与 accent 使用同一散布布局，切换变体时位置不会跳。
- 踩点：把素材起点对齐节拍，1.0s 后的故障爆发就是强调点；可和 BGM、关键词、音效共用同一 cue。

未来可能新增的字段（暂未接入 planner）：

| 字段 | 用途 |
|---|---|
| `series` | 系列 id |
| `seriesIndex` | 系列内序号 |
| `cueRole` | base / accent / hold / exit |
| `cueOffset` | 相对节拍的偏移（帧或秒） |
| `cueDuration` | 单次 cue 的持续时间 |
| `loop` | 是否可无缝循环 |

在用户给出完整设计思路前，只保留 `category` / `series` / `seriesIndex` / `loop`，不提前固化 cue 语义。

## 5. 取舍与分组

- 不产生“无意义数字计数”（T08 `text-count`）和“杂乱噪声流场”（P05 `particle-flow`）这类素材；两个 recipe 已于 2026-11-09 标记 `disabled`，现有素材退役。
- 相似素材按 `series` 聚组，`seriesIndex` 表示变体序号：recipe 默认用 recipe id，preset 默认用 preset id；`icon-morph` 使用显式 `platform-icons` 系列。
- 工作台素材页支持“按系列分组”，默认隐藏退役素材（显示全部活跃变体）；退役素材可在状态筛选里查看。

## 6. 制作检查清单

1. 先定 category 和它在画面里的角色（底图 / 强调 / 转场 / 纹理）。
2. 确定是循环、保持、还是清空结束；在元数据里写清楚。
3. 动画必须在结束时完成：图标完整、文字完整、loading 回到起点、转场回到透明。
4. 透明素材输出 WebM alpha；叠在实拍上检查边缘、黑边、亮度。
5. 运行 `node run.mjs quality --force`，确认没有 `loop-mismatch` / `end-unsettled` / `end-residue`。
6. 抽首帧、中帧、末帧人工复查；质量指标不能替代肉眼。
7. 更新 `docs/MODULES.md`、`CREDITS.md`（如果新增资源）与质量报告。

## 7. 当前状态

- `fission` 默认不再生成 work 专属素材，直接使用 shared 素材库；需要专属素材时加 `--with-assets`。
- `mix --work` 不再强制至少使用一条 work 素材；`requireWorkAsset` 默认关闭。
- `icon-morph` 已修正循环收尾；两个变体的首尾 Hamming 为 2 / 0。
- `particle-orbs` / `particle-dust` 改为整数周期循环；共享与 work-20261121-3 素材已重渲。
- 当前 92 条 catalog：70 approved / 13 draft / 9 retired；83 条活跃素材 0 条质量失败，5 条极淡/静止警告；质量报告新增 `category` / `series` 轴与完整性指标。
- 新增 `platform-icons-neon` / `platform-icons-neon-global` 两组霓虹系列：各 7 个变体（基础 + 6 平台故障），cyber 霓虹风格，品牌色图标，故障分别在 1.0s / 0.4s。
- T08 `text-count` / P05 `particle-flow` 已禁用，9 条相关素材退役；相似素材按 `series` 聚合，工作台默认只看 approved 并可“按系列分组”。
- 工作台用中文展示类型、状态和质量标记，并可按类型筛选。
- 完整的分类体系、系列命名、cue 字段与踩点策略等待用户提供设计思路后细化。

## 8. 创意工程

2026-11-14 起，生成素材的唯一来源是 `creative/`：引擎实现默认跟随创意工程放在 `engine/`，被复用的引擎放在 `creative/engines/`；创意工程用变体 items 产出素材。文字、转场、粒子、镜头、霓虹图标、四个场景引擎、icon-morph、ui-mock 都已迁完，共 11 个工程 / 55 条活跃素材。旧的 preset/recipe 生成路径已删除。

## 9. 素材部署

素材二进制和清单都属于内容包：`creative/shared/assets.manifest.json` 记录每个文件的路径、哈希、许可、来源与可选下载地址；落点是独立素材库 `assets/`（gitignore，不随核心仓库提交）。`config/pipeline.json` 的 `assets.roots` 可配多个根，按顺序合并：同名单目录会递归合并，同一相对路径由前一个根优先；`--asset-roots` 可临时覆盖。

素材根和实拍根用同一套规则：`pipeline.json` 只放可移植的默认值（`"assets"` / `"footage"`），机器相关的绝对路径写 `config/local.json`（gitignore，参考 `config/local.example.json`）。

没有清单时视为空核心：`assets:check` / `sync` 跳过素材检查并成功退出，渲染用空字体清单。

```bash
npm run assets:check          # 缺失检查
npm run assets:verify         # 额外做 SHA-256
npm run assets:scan           # 磁盘与清单差异：新增 / 变更 / 缺失
npm run assets:fetch          # 下载有稳定直链的条目
npm run assets:fetch -- --from D:/my-assets
node tools/assets.mjs scan --apply            # 登记新文件（license=unknown，待人工补）
node tools/assets.mjs scan --apply --prune    # 同时移除已删文件的清单条目
node tools/assets.mjs check --strict          # license=unknown 时失败
```

没有稳定直链的条目（部分图标、Impact/Digital 音效、Kevin MacLeod 曲目、品牌 logo、中文展示字体）需要用户通过 `--from` 提供。

许可与署名见 `creative/shared/CREDITS.md`。音效与 BGM 索引在 `creative/shared/audio/{sfx,music}.index.json`，音频文件仍在素材根 `assets/{sfx,music}`；索引缺失时静音，不报错。

