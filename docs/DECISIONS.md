# DECISIONS

影响架构或流程的选择。新决策追加，不删除旧记录；被推翻时标注 superseded。

## ADR-001 · 独立工作区 + vendored common 快照

- 背景：需要脱离上游 Remotion 工作区独立运行，新会话可直接开始。
- 选项：运行时引用上游 `common/`；或复制快照。
- 结论：复制 `common/{engine,components,vendor,assets,shots}` 到本工作区，保持原目录关系。
- 代价：上游更新需整目录替换并重新验证；换来自包含、可离线、可单独提交。

## ADR-002 · public 用目录链接，不拷贝素材

- 背景：实拍素材在外部目录，生成素材与缩略图在运行时目录。
- 选项：把素材复制进 `public/`；或用链接。
- 结论：`public/assets` 指向 `common/assets`，`public/generated` 指向 `out/assets`，`public/footage` 下每个 root 一个 junction，`public/thumbs` 指向 `data/thumbs`。
- 代价：Windows 需要 junction（无需管理员）；链接冲突时拒绝覆盖，保护用户数据。

## ADR-003 · MP4 与透明 WebM 分开 props

- 背景：同一 preset 既要出实底 MP4，又要出透明 WebM。
- 选项：一份 props 用 `alpha` 分支；或两份 props。
- 结论：每个素材生成 `propsMp4File`（`alpha:false`）与 `propsWebmFile`（`alpha:true`）。
- 代价：多一份 JSON；换来实底与透明两条链路互不污染。

## ADR-004 · 视觉签名 + 源区间双重去重

- 背景：同素材要出多条不重复的成片。
- 选项：只限制素材不复用；或只限制源区间；或两者都限制。
- 结论：
  - 同一成片内：源区间不重叠、相邻不重复、签名唯一；
  - 跨成片：`signatures.json` 记录签名与区间；
  - 签名 = 素材 + 区间 + 裁切/缩放/运动/速度/调色/叠加的哈希。
- 代价：素材少时会降级并标 `relaxed`；换来可验证的「同素材不同画面」。

## ADR-005 · 带 crop 的素材锁定裁剪中心，禁用 pan

- 背景：横屏录屏左右有黑边，随机焦点会把黑边带进 9:16。
- 选项：给素材做代理；或在渲染时用 `object-position` 对准 crop；或完全禁用这类素材。
- 结论：`focusFor()` 对 `crop` 素材使用裁剪中心；运动限制为 push/pull/still。
- 代价：这类素材的构图变化少一些；换来画面干净。
- 后续：素材量大时可加「代理转码」选项，把 crop 烘进 proxy。

## ADR-006 · 默认静音

- 背景：混剪需要音频，但音乐许可/风格因项目而异。
- 结论：`mix.music` 默认 `null`；需要时在配置里指定，并保留 CC BY 署名。
- 代价：默认成片无声；避免默认带入不合适的音乐或漏署名。

## ADR-007 · 生成片段是示意，不冒充实拍

- 背景：品牌图标、UI mock、互联动画都是生成内容。
- 结论：生成片段可叠加、可全屏，但不冒充实拍；手机 UI 等标「示意」；品牌图标不表示合作。
- 代价：画面多一个「示意」标记；避免误导和平台风险。

## ADR-008 · 本地 Remotion 入口 + calculateMetadata

- 背景：素材数量与时长由目录决定，Composition 不能写死。
- 结论：`src/index.ts` 注册 `PipelineAsset` 与 `MixVideo`；用 `calculateMetadata` 从 props 读取 `durationInFrames/fps/width/height`；渲染传 `--props=<json>`。
- 代价：每次渲染多一个 props 文件；换来一批素材共用一套 composition。

## ADR-009 · 局部生成时合并目录

- 背景：`generate --only` 只重渲一个 preset。
- 结论：合并旧 `catalog.json`，保留不在本次 presets 内的条目；同一 preset 的旧条目由新结果替换。
- 代价：要彻底清理旧条目时需手动删 `data/catalog.json`；避免误删其它 preset。

## ADR-010 · 来源不上屏

- 背景：素材来源、平台声明、出处角标会破坏画面，也容易与素材不一致。
- 结论：来源只进 `CREDITS.md`；画面不印出处、不印内部标签、不印分镜描述词。
- 代价：合规信息不在画面里；发布时由账号说明/描述承担。

## ADR-011 · 生成素材分层 + recipe + 审核闸门

- 背景：P0 需要让生成模块持续产出，而不是继续增加全屏 preset。
- 选项：
  1. 继续为每个动效写一个 preset；
  2. 把素材拆成 scene / overlay / transition，并用 recipe 数据驱动；
  3. 只加审核，不改编排模型。
- 结论：采用 2 + 审核闸门：
  - catalog 增加 `layer / sceneCapable / overlayCapable / transitionCapable / status / beatRoles / recipeId`；
  - `src/generated/recipes.json` 作为配方注册表；
  - `text-atom`、`transition-atom` 作为通用引擎；
  - 新素材默认 `draft`，mix 只消费 `approved`；
  - 转场以 `shot.transitionAsset` 挂到镜头开头。
- 代价：
  - EDL 与 catalog 结构变大，需要维护状态；
  - 文本动效仍需要文案源，当前只支持 recipe 默认短语；
  - 转场只在镜头开头播放，镜头末尾或双段转场留到后续。
- 后续：P1 加 SFX 轨与 Particle / Camera 引擎；P2 加 pHash / 覆盖率。

## ADR-012 · 开放版权音频库 + 角色化声音设计 + BGM 自动选曲

- 背景：P1 需要音效 / BGM 有逻辑、有设计感，且不能引入许可风险。
- 选项：
  1. 只用本地合成音效；
  2. 从开放版权库取素材 + 设计映射；
  3. 只加一条 BGM，不做 SFX。
- 结论：
  - SFX 来自 Kenney CC0（UI / Interface / Impact / Digital），本地转 48kHz WAV、-18 LUFS；
  - BGM 来自 AERIS MUSIC CC0，保留 Kevin MacLeod CC BY 作为备用；
  - 默认 `music: auto`，按情绪 / 能量 / 时长 / 许可评分选曲；
  - SFX 按叙事角色、转场、文字叠加、UI mock 落点；
  - 音乐按角色能量曲线，SFX 活跃时 duck。
- 代价：
  - 音频素材与索引需要维护；
  - CC BY 曲目发布时需署名；
  - 自动选曲是规则评分，不是人工试听。

## ADR-013 · ParticleEngine 与 CameraEngine 作为 recipe 引擎

- 背景：P1 要让生成素材继续扩展，但不为每个效果写新 preset。
- 结论：
  - `particle-atom` 支持 P01 / P04 / P05，透明 overlay；
  - `camera-scene` 包装现有 scene，支持 C01 / C02 / C06 / C09；
  - camera 引擎的镜头在混剪中锁定 `motion: still`，避免二次运镜；
  - 新效果优先加 recipe，只有无法表达时才加引擎。
- 代价：
  - `CameraScene` 直接 import 现有 preset，`basePreset` 列表需要手动维护；
  - particle 使用 DOM / SVG，数量大时渲染成本上升。

## ADR-014 · 作品级生成素材隔离 + 缓存 + 手动提升/清理

- 背景：裂变作品需要彼此独立、不重复；现有共享 catalog 会被反复复用。
- 选项：
  1. 共享 catalog + seed 变化；
  2. 每个作品独立生成全部素材，不缓存；
  3. 按作品生成、缓存、隔离，shared 手动提升。
- 结论：采用 3：
  - `fission` 从完整 recipe pool 按 workSeed 选材；work 素材 `scope=work`，自动 `approved`；
  - catalog 增加 `scope / workId / workSeed / sharedAt`；素材 ID 含 workId；
  - `mix --work` 只用 shared + 当前 work；planner 优先 work-local，并要求至少使用一条；
  - `--share` 提升为 shared；`--list-works` / `--clean-work` 手动管理；不自动清理。
- 代价：
  - 渲染更慢，素材库会增长；
  - recipe 池有限时，作品差异仍受限制；
  - shared 提升需要人工判断质量与通用度。

## ADR-015 · 裂变的多轴 variation

- 背景：动效语法有限，但元素、构图、光色、文案、节奏和语境可以近乎无限；只增加 recipe 不足以扩大观感差异。
- 结论：
  - 新增 `src/generated/variation.json` 与 `modules/generate/variation.mjs`；
  - 每个 work 独立选择调色板、文本版式/背景/光位/字体/文案、粒子分布/背景、镜头底图/icons/post/grade、转场角度/强度、时长、节奏 profile、实拍主题；
  - 选择结果写入 catalog `variation` 与 EDL `variation` / `workProfile`；
  - 调色板、节奏、素材主题使用独立 hash，避免轴之间相关性。
- 代价：
  - 组合空间变大，质量与重复检查更难，需要 pHash / 覆盖矩阵；
  - 不同轴对观感的影响不同，需要后续用真实成片校准；
  - 变化轴过多会让作品失去统一识别度，需要保留品牌基线。


## ADR-016 · 用 ffmpeg 原始帧 + JS DCT 做 pHash，不引入图像库

- 背景：变化轴变多后，需要从成片本身判断“看起来是否重复”，而不是只相信参数。候选是引入 `sharp` / `jimp` 解码图片，或直接用 ffmpeg 抽小尺寸原始帧。
- 选项：
  1. 引入 `sharp`：快，但 Windows 安装与 Remotion 原生模块叠加，增加依赖和许可登记；
  2. 引入纯 JS 图像库：解码仍要依赖 ffmpeg 或额外编码器；
  3. ffmpeg 输出 32px 级 `rawvideo`，在 JS 里做 DCT / 指标。
- 结论：采用 3：
  - `modules/lib/vision.mjs` 抽 RGB / alpha 原始帧；
  - 32×32 灰度做 2D DCT，取 8×8 低频，中位数阈值生成 64 bit pHash；
  - alpha、运动能量、亮度/对比度、平均色在同一批帧上计算；
  - 不新增 npm 依赖，沿用现有 ffmpeg 与 doctor 检查。
- 代价：
  - 每段素材大约多 1–2 次 ffmpeg 抽帧；27 条素材全量分析约数秒；
  - 32px 级 alpha 会被 area 缩放稀释，阈值必须按缩放后的值校准（见 `docs/LESSONS.md`）；
  - pHash 对纯色/极简画面区分度有限，仍需人工抽帧复查。

## ADR-017 · 节拍与镜头解耦：目标镜头长度 + 抖动 + 长短交替

- 背景：6 秒作品固定 5 个镜头、4 个切点，平均 1.2 秒一刀；同一 rhythm profile（punchy）的多条作品镜头时长完全相同，观感节奏发死。
- 原因：叙事节拍和镜头被绑成一对一；6 秒内每个节拍只够 1 刀，`splitBeat` 不会触发；节拍比例又是 profile 固定值，没有按作品抖动。
- 选项：
  1. 只调大 `splitBeat` 的镜头长度阈值——短节拍仍然一刀，解决不了；
  2. 减少叙事节拍数量——会丢 hook / build / proof / turn / close 的故事结构；
  3. 节拍保持故事窗口，镜头独立规划：按目标镜头长度决定数量，再合并/拆分节拍。
- 结论：采用 3：
  - `planBeats` 按 `beatJitter` 对每个作品的节拍时长做 ±15% 抖动并归一化；
  - `planShotSegments` 用 `shotLength.min/max` 算目标镜头数（`minShots` / `maxShots` 约束）；
  - 先合并中间节拍（保护 turn / close），再拆分过长镜头；拆分按长短交替比例；
  - `turnHint` 只留给包含 turn 的第一段，避免拆出连续多个生成镜头；
  - EDL 的 `beats[]` 仍是叙事窗口，`beats[].shots[]` 按镜头起点归属，允许空数组；`MixVideo` 本来就扁平读取 shots。
- 代价：
  - 镜头可以跨节拍，beat 与 shot 不再是 1:1，排查 EDL 时要看 `shot.at/dur` 而不是 beat 边界；
  - 空 beat 的静帧与统计需要跳过；
  - 目标镜头长度是近似值，实际会被节拍边界、转场和最短镜头约束拉动。

## ADR-018 · 本地 Web 工作台包一层 CLI，不重写流水线

- 背景：需要可视化浏览素材、看成片、跑任务；候选是 Remotion Studio、Electron/Tauri 桌面应用、本地 Web 页面，或把流水线改成常驻服务。
- 选项：
  1. Remotion Studio：只适合看 composition，不适合管理素材/EDL/质量；
  2. Electron/Tauri：体验好，但打包、签名、更新成本高；
  3. 本地 Node HTTP + 静态前端：零新增依赖，直接包现有 CLI；
  4. 重写成常驻服务：改动最大，且会破坏现有确定性/缓存边界。
- 结论：采用 3：
  - `workbench/server.mjs` 用 Node 自带 `http` 起服务，只绑定 `127.0.0.1`；
  - 前端为静态 HTML/CSS/JS，无构建步骤；
  - 任务通过 `spawn(node, [run.mjs, stage, ...args])` 调用现有阶段，不经过 shell；
  - 单任务队列 + 日志落盘 + SSE 实时输出 + Range 媒体服务；
  - 素材操作（approve/reject/share/clean-work）也走同一队列。
- 代价：
  - UI 和 CLI 参数需要同步维护；新增 stage 时要更新表单 schema；
  - 没有登录/权限，只适合本机；
  - 一次只能跑一个任务，批量吞吐仍受 Remotion 串行限制；
  - 发布/上传未实现，先做浏览、任务与打包，平台 API 单独评估。

## ADR-019 · 裂变与生成素材解耦；生成素材按类型保证完整

- 背景：
  - 裂变此前强制为每个作品生成一套 work 素材，批量生产时渲染成本高，且与“生成素材是辅助层”的定位不符。
  - 现有生成素材缺少类型与完整性约束，出现 `icon-morph` 在半个图标上结束这类不合格素材。
- 选项：
  1. 保持 work-local 生成，仅优化速度；
  2. 裂变只做编排，素材全部复用 shared；
  3. 默认复用 shared，保留 `--with-assets` 按需生成作品专属素材。
- 结论：采用 3：
  - `fission.generateAssets` 默认 `false`；`--with-assets` 显式开启；
  - `mix.requireWorkAsset` 默认 `false`，`mix --work` 没有专属素材时使用 shared；
  - catalog 增加 `category / series / seriesIndex / loop`；
  - 质量模块增加 `firstLastHamming / endMotion / alphaEnd`，按类型标记 `loop-mismatch / end-unsettled / end-residue`；
  - `icon-morph` 按完整循环重写收尾，`loop = true`。
- 代价：
  - 默认裂变的“作品专属感”下降，差异更多依赖编排、variation 与素材组合；
  - 分类与系列字段目前是初步版本，完整 taxonomy / cue 语义等用户设计稿；
  - 完整性检查仍以指标为主，最终需要人工抽帧复查。

## ADR-020 · 创意工程作为生成素材的唯一来源

- 背景：生成素材由 `recipes.json` 大数组 + preset 列表产出，参数、变体、文案埋在代码里，用户无法按创意微调和管理；素材库像一次性写好的黑盒。实拍有 scan 与外部目录，混剪有项目包，生成素材缺少对等的工程单位。
- 选项：
  1. 继续维护 recipes.json，只加项目级覆盖；
  2. 把创意拆成目录 + 参数 schema，但新旧两套长期并存；
  3. 以创意工程为唯一来源，迁移完成后删除旧 preset/recipe 生成路径。
- 结论：采用 3：
  - `creative/engines/*.json` 声明引擎参数（中文 label、类型、范围、默认值）与 styles；
  - `creative/<id>/creative.json` + `variants/*.json` 声明意图、内容与 1-n 个变体，每个 item 编译一条素材；
  - 产物强制带 `creativeId / variantId / creativeVersion / paramsHash`，无出处不能保持 approved；
  - CLI `node run.mjs creative scan|validate|plan|build|preview|review|reset`；
  - 工作台 `#/creative` 由 schema 生成控件，支持保存、预览、构建、审核；
  - 先迁移文字（text-display），再迁移图标/粒子/转场/镜头/场景，最后删除 `recipes.json` 与 `modules/generate/{index,recipes}.mjs`，清空旧产物重建。
- 代价：
  - 迁移期需要逐组对比旧素材；
  - 引擎 schema 是组件 props 的镜像，新增参数要两边同步；
  - 工作台成为必要入口，纯命令行仍保留但编辑体验较弱；
  - 切换时清空 catalog / props / out/assets，审批与质量历史不保留。

## ADR-021 · 核心与内容/素材彻底分层

- 背景：`docs/PLAN-CORE-CLEAN.md` 的判定标准是「删掉 `creative/` 与 `common/assets/` 后 core 仍能安装、typecheck、check、doctor；放回内容后能自动识别并生产」。此前 core 仍带着调色板枚举、引擎 props、字体清单、素材清单、镜头卡和具体项目引用，clone 下来无法只换内容包。
- 选项：
  1. 只把二进制移出仓库，类型/清单留在 core；
  2. 内容与清单整体移入内容包，core 只留通用透传类型与扫描命令；
  3. 拆成独立 npm 包。
- 结论：采用 2：
  - `src/types.ts` 只留 `EngineProps / PresetMeta / AssetProps`（均带索引签名）；引擎精确 props 移到 `creative/shared/types.ts`，注册表统一导出 `React.FC<EngineProps>` 并在赋值处断言；
  - `FONT_MANIFEST` 移到 `creative/shared/fonts.ts`，由 `creative/registry.ts` re-export，缺失时导出空数组；`GeneratedAsset` 与 `MixVideo` 都从注册表取；
  - 素材清单移到 `creative/shared/assets.manifest.json`；`tools/assets.mjs` 新增 `scan`（`--apply / --prune / --check`）与 `--strict` 许可闸门；
  - 音频索引、镜头卡、素材许可移到 `creative/shared/`；`common/` 只剩 `engine/` 与 `vendor/`；
  - 新增 `node run.mjs sync`（覆盖注册表 + 素材清单 + 可选实拍），`npm run check` 走 `sync --check`，`creative build` 在注册表过期时自动重写；
  - 新增 `node run.mjs projects scan`；`config/components.json` 不再列具体项目；
  - 没有内容包或素材时所有命令给出“无内容”提示并成功，只有需要渲染素材的阶段才报错。
- 代价：
  - 引擎内部保持精确类型，注册表侧必须断言，泛化会削弱一点类型安全；
  - 内容包成为 typecheck 的硬依赖，clone 后依赖 postinstall 生成空注册表；
  - 新增素材要显式 `scan --apply`，不再“放进目录就生效”，换来许可闸门与可迁移清单；
  - `common/shots`、`common/assets/REGISTRY.json`、`common/assets/{sfx,music}/index.json` 这些旧路径失效，文档与脚本已同步。

## ADR-022 · 素材库独立成根，支持多目录合并

- 背景：ADR-021 之后素材仍部署在 `common/assets`，使 `common/` 名义上“只剩 engine/vendor”却在运行后多出一个素材目录；且单根目录限制了“用户已有素材分散在多个位置”的用法。实拍库早已支持 `footage.roots` 多根，素材库没有对应能力。
- 选项：
  1. 保持 `common/assets` 单根，只改文档；
  2. 独立成 `assets/` 单根；
  3. 独立成可配置多根，按顺序合并，创意只写相对路径。
- 结论：采用 3：
  - `config/pipeline.json` 增加 `assets.roots`（默认 `["assets"]`），`cfg.assetRoots` 解析、`cfg.paths.assets` 为首根；`--asset-roots` 可临时覆盖；
  - `public/assets` 改为实体目录，按根顺序为每个顶层项建立 junction（顶层文件用硬链接，失败则复制）；同名项前者优先并告警；素材根移除后自动清理失效链接；
  - 清单 `creative/shared/assets.manifest.json` 去掉 `root` 字段，路径一律相对素材根；`check` 在任一根命中即视为存在，`fetch/scan --apply` 写入首根；
  - 创意引用改为相对路径：新增 `assetPath()`（`common/engine`），引擎与 `IconTile`/`clips`/`icon-neon` 用它把 `icons/x.svg` 规范为 `assets/...`，`assets/` 前缀与绝对 URL 原样保留；
  - 音频索引按 `assets.roots` 查找，EDL 的 `music/sfx` src 统一为 `assets/...`；
  - `doctor`/`check`/工作台按多根报告素材状态。
- 代价：
  - 合并按相对路径去重：同名文件由前一个根优先（会告警）；同名目录会递归合并，所以第二个根里的新文件仍然可见；
  - `public/assets` 从单条 junction 变成“整目录能链接就链接、冲突目录递归合并”的实体树，`check`/`doctor` 的判定同步放宽；
  - 跨盘的顶层文件无法建硬链接时退化为复制，需要重跑 scan/sync 才更新；
  - 旧 EDL 里的 `music/...` 仍保留可读（`public/music` 仍指向第一个含 music 的根），新 EDL 使用 `assets/music/...`。

## ADR-023 · 移除实拍自动打标与 recipe 遗留概念

- 背景：`tagger.mjs` 用文件名/路径关键词猜标签；实测 26 条实拍只有 `actions: ["展示"]`，创意 `appliesTo.footageTags` 全为空。标签唯一被消费的地方是裂变时按主题筛实拍（不足 5 条回退全池）与工作台展示/搜索。内容持续变化时，关键词表无法维护，标签也无法人工管理。
- 选项：
  1. 保留并扩充词表；
  2. 改为纯人工 sidecar；
  3. 删除自动打标与主题筛选。
- 结论：采用 3：
  - 删除 `modules/lib/tagger.mjs`、`footage.sidecars` 配置、`data/human-tags.json` 支持；
  - 删除 `mix.footageTags` 过滤与 `variation.footageThemes`；
  - 工作台不再显示/搜索标签；scan 自动清理旧条目的 `tags` / `orientation` 字段；
  - 同时清理已删除功能的遗留：catalog/EDL 的 `recipeId`、`mix.maxPerRecipe` → `mix.maxPerCreative`、质量轴里的 `Recipe`；`variation.mjs` 改为按 `category` 驱动，去掉文案/引擎键/`T06`/`T08` 硬编码与已删除的 `src/generated/assets.json`。
- 代价：
  - 失去按主题自动挑实拍的能力；需要时在变体或项目层自行分组，或以后做显式人工标签；
  - 旧 catalog/EDL 里的 `recipeId` 字段被忽略，不再参与任何行为。
