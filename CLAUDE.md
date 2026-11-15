# CLAUDE.md · video-pipeline 工作区

这是一个独立的「实拍素材 + 生成动效素材 → 混剪成片」工作区。新会话先按第 0 节自检，再动手。

## 0. 开工顺序（硬流程）

1. 读 `STATUS.md`、`docs/README.md`、`docs/reference/RULES.md`；涉及公共资源看 `docs/architecture/SHARED.md`；涉及生成素材再看 `docs/architecture/CREATIVE.md`。`docs/records/LESSONS.md` 是短清单可整读；`docs/records/DECISIONS.md` 是索引；`docs/archive/` 默认不读，只有追溯问题时搜索。
2. 跑 `npm run doctor`；缺依赖、ffmpeg、浏览器、素材根目录，先修再继续。
3. 看 `config/pipeline.json` 的 `footage.roots`、`spec`、`shared`、`creative`、`mix`；`node run.mjs shared status` 确认公共资源层状态。
4. 素材有变化先 `node run.mjs scan`；创意/生成素材有变化先 `node run.mjs creative build`。
5. 生成/裂变后跑 `node run.mjs quality --report-only` 看感知重复与覆盖；出片走 `node run.mjs mix`，它会先出静帧、再分 3 段抽帧、最后全片。
6. 收尾：
   - 更新 `STATUS.md`；
   - 有新坑追加 `docs/records/LESSONS.md`；
   - 新组件登记 `docs/architecture/ARCHITECTURE.md`；
   - 新依赖登记 `docs/dependencies.json` 与 `docs/operations/DEPENDENCIES.md`；
   - 新素材/字体/图标更新 `shared/CREDITS.md` 并用 `node tools/assets.mjs scan --apply` 登记；
   - 跑 `npm run check` 和 `npm run typecheck`。

## 1. 一句话定位

把实拍素材扫描成可检索的镜头库，生成可叠加的动效素材，再自动混剪成「同素材而画面不重复」的竖屏视频。

## 2. 目录

| 位置 | 放什么 |
|---|---|
| `config/pipeline.json` | 主配置：规格、素材根、生成 preset、混剪节拍 |
| `run.mjs` | 一键入口：`scan / creative / quality / mix / all / stills / check` |
| `modules/scan` | 扫描、增量、场景切分、缩略图 |
| `modules/generate` | 共享目录与渲染工具：catalog、props、reindex、静帧 |
| `modules/creative` | 创意工程：引擎 schema、参数校验、编译、渲染、审核 |
| `shared` | 公共资源与预设（gitignore）：素材清单、字体/音频索引、设计令牌与平台避让、公共代码、镜头卡 |
| `creative` | 创意工程包（gitignore）：每个工程独立，自带 `engine/`、变体，可选 `assets/` |
| `modules/quality` | pHash、观感相似度、感知聚类、覆盖矩阵、质量闸门 |
| `modules/mix` | EDL 规划、去重、渲染 |
| `modules/lib` | 配置、ffmpeg、public 链接、Remotion 封装 |
| `workbench` | 本地 Web 工作台：素材/成片/质量浏览、任务队列、实时日志 |
| `projects` | 具体成片项目：TTS、分镜脚本、混音与项目说明 |
| `src` | Remotion composition：`PipelineAsset`、`MixVideo`、通用类型（`types.ts` 只放 `EngineProps / PresetMeta / AssetProps`） |
| `common` | 核心原语：只剩 `engine/`（不含任何项目设计令牌或创意实现） |
| `assets` | 素材库（内容部署，gitignore；`config/pipeline.json` 的 `assets.roots` 可配多根） |
| `data` | 运行产物：素材库、目录、EDL、签名库（gitignore） |
| `out` | 生成素材、静帧、分段、成片（gitignore） |
| `public` | 渲染静态根，运行时自动建链接（gitignore） |
| `docs` | 规则、经验、流程、模块、依赖、决策、排错 |
| `tools` | 体检与内容同步：`doctor`、`check`、`shared`、`assets`、`sync`、`projects` |

## 3. 七条硬规则

1. **实拍是事实，生成是示意。** 生成片段不能冒充实拍；手机 UI 等示意画面必须带「示意」标记。品牌图标只作类别示意，不表示合作或背书。
2. **确定性。** `src/` 与 `creative/` 里的动画只能由 `useCurrentFrame()` / `useVideoConfig()` 推导；禁止 `Date.now`、`new Date`、`Math.random`。随机用 `keyedRandom(seed, key)` 或 Canvas 引擎的 `rng(seed)`。`npm run check` 会扫。
3. **不自己发明素材。** 图标、字体、地图、音乐、镜头卡、动效实现，先用 `shared/` 的清单与素材库 `assets/` 已有内容；新增二进制素材必须用 `node tools/assets.mjs scan --apply` 登记到 `shared/assets.manifest.json` 并更新 `shared/CREDITS.md`。素材二进制与清单都不进核心仓库，通过 `npm run assets:fetch` 或用户目录部署。许可不清楚的素材不用。
4. **配置优先。** 路径、规格、preset、节拍、时长都通过 `config/pipeline.json` 或 CLI 参数指定；不要把作品参数硬编码进模块。
5. **先查现成，再写。** 顺序：Remotion 官方包 → 成熟第三方库 → `common/engine` → 自己写。新依赖必须先登记 `docs/dependencies.json`，否则 `check` 失败。
6. **先有主题，再动手。** 每次出片先能用一句话说清「这条片子讲什么画面」。删掉后画面不受影响的内容，就是叠加，应当删除。
7. **Agent 只在内容区工作。** 人类与 Agent 都只改 `creative/`、`shared/`、`assets/`、`projects/` 与 `config/local.json`；核心（`modules/`、`src/`、`tools/`、`workbench/`）的改动必须是独立任务。不得自创目录、配置键、命令或平行流程；创意任务按 `docs/operations/WORKFLOW.md` 第 12 节的命令链执行。

## 4. 数据契约

- `data/footage.manifest.json`：全量素材索引，含 `status: active | missing`。
- `data/library.json`：给模块三用的活跃素材数组，含 `scenes[]`、`crop`、`publicSrc`。
- `data/catalog.json`：生成素材目录，含 `publicMp4`、`publicWebm`、`props`、`duration`、`quality`；创意图材另有 `creativeId / variantId / creativeVersion / paramsHash`。
- `data/quality/report.json`：质量与覆盖报告；`out/quality/report.md`：人读版。
- `data/edl/mix-*.json`：成片时间线；`beats[]` 是叙事窗口，镜头可跨节拍，`beats[].shots[]` 允许为空。`data/edl/signatures.json`：跨成片去重记录。
- `out/assets`：生成素材；`out/stills`：静帧；`out/segments`：分段；`out/mix-*.mp4`：成片。

不要手改 `data/` 里的自动产物；要改就改配置或源码，然后重跑对应 stage。

## 5. 经验制度

每次任务结束必须留痕：

1. `STATUS.md`：当前状态、最近验证、待办；历史会话进 `docs/archive/STATUS-HISTORY.md`。
2. 新坑：完整记录（现象 / 原因 / 修法 / 预防）追加到 `docs/archive/LESSONS-HISTORY.md`，再把一条可执行规则写进 `docs/records/LESSONS.md`。
3. 新决策：全文追加到 `docs/archive/DECISIONS-ADRS.md`，`docs/records/DECISIONS.md` 只加一行索引与状态（active / superseded）。
4. `docs/architecture/ARCHITECTURE.md`：新增或修改模块后更新。
5. `docs/operations/DEPENDENCIES.md` + `docs/dependencies.json`：新增依赖后同步。
6. `shared/CREDITS.md` + `shared/assets.manifest.json`：新增素材后同步（`node tools/assets.mjs scan --apply`）。

新会话不要求记住上一个会话，只要求按这套文档恢复上下文。

## 6. 常用命令

```bash
npm run doctor
npm run workbench
node run.mjs all
node run.mjs scan --check
node run.mjs shared init
node run.mjs shared status
node run.mjs shared validate --strict
node run.mjs sync --check
node run.mjs sync --apply
node run.mjs projects scan
npm run assets:scan
npm run assets:check
node run.mjs creative new my-effect --name 我的动效
node run.mjs creative scan
node run.mjs creative validate --strict
node run.mjs creative scan --write-registry
node run.mjs creative plan --creative text-display
node run.mjs creative build --creative text-display
node run.mjs creative preview --creative text-display --variant char-rise
node run.mjs quality --report-only
node run.mjs quality --strict
node run.mjs mix --duration 15 --outputs 2 --seed 20261108
node run.mjs mix --duration 15 --seed 20261108 --shot-length 2.4
node run.mjs stills
node run.mjs check
npm run check
npm run typecheck
```

## 7. 画面与文案红线

- 文案不是字幕：文字是画面的一部分，不做底部字幕轨。
- 不把「开场 / 背景 / 要点 / 证据 / 但是 / 结论」这类内部标签印到画面上。
- 出处、来源、平台声明不上屏，只进 `CREDITS.md`。
- 不写绝对说法；CTA 直接指向主页。
- 生成片段需要示意时标「示意」；不要用生成画面冒充真实操作或真实结果。

## 8. 关于 common/

`common/` 只剩 `engine/` 一棵子树，全部是通用原语，不含任何创意实现或项目设计令牌：

- `common/engine`：运动数学、时间工具、字体门、Canvas/WebGL 桥、`assetPath`；
- 素材库是独立的 `assets/`（gitignore，`config/pipeline.json` 的 `assets.roots` 可配多根），不属于核心源码；设计令牌、公共代码、素材清单与镜头卡都在 `shared/`。

不要在 `common/` 里直接实现业务逻辑，也不要往核心提交具体创意实现或平台预设。`common/engine` 里的 `motion-core`、`time`、`fonts` 源自 fy-code-animation（作者免费分享），其余为自写；见 `common/engine/README.md`。升级后跑 `npm run sync -- --check`、`npm run doctor`、`npm run typecheck`、`node run.mjs creative build --force` 验证。

## 9. 不确定时

- 规格、时长、受众不清楚：先问，不猜。
- 素材许可不清楚：不用，换素材或问用户。
- 要改公共层：先看 `docs/architecture/ARCHITECTURE.md`，能组合就不新增。
- 要新增/修改生成素材：先看 `docs/architecture/ASSETS.md`；声明 `category`，保证动画完整（循环闭合 / 末帧稳定 / 转场回透明），跑 `node run.mjs quality --force`。
- 裂变默认只复用 shared 素材库；需要作品专属素材时才加 `--with-assets`，不要默认生成。
- 要新增依赖：先看 `docs/operations/DEPENDENCIES.md` 的候选表，走 3 帧确定性测试后再登记。
