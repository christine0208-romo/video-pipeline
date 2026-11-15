# CLAUDE.md · video-pipeline 工作区

这是一个独立的「实拍素材 + 生成动效素材 → 混剪成片」工作区。新会话先按第 0 节自检，再动手。

## 0. 开工顺序（硬流程）

1. 读 `STATUS.md`、`docs/LESSONS.md`、`docs/RULES.md`；涉及生成素材再看 `docs/CREATIVE.md`；存在 `docs/PLAN-CORE-CLEAN.md` 时先按它执行。
2. 跑 `npm run doctor`；缺依赖、ffmpeg、浏览器、素材根目录，先修再继续。
3. 看 `config/pipeline.json` 的 `footage.roots`、`spec`、`creative`、`mix`。
4. 素材有变化先 `node run.mjs scan`；创意/生成素材有变化先 `node run.mjs creative build`。
5. 生成/裂变后跑 `node run.mjs quality --report-only` 看感知重复与覆盖；出片走 `node run.mjs mix`，它会先出静帧、再分 3 段抽帧、最后全片。
6. 收尾：
   - 更新 `STATUS.md`；
   - 有新坑追加 `docs/LESSONS.md`；
   - 新组件登记 `docs/MODULES.md`；
   - 新依赖登记 `docs/dependencies.json` 与 `docs/DEPENDENCIES.md`；
   - 新素材/字体/图标更新 `creative/shared/CREDITS.md` 并用 `node tools/assets.mjs scan --apply` 登记；
   - 跑 `npm run check` 和 `npm run typecheck`。

## 1. 一句话定位

把实拍素材扫描成可检索的镜头库，生成可叠加的动效素材，再自动混剪成「同素材而画面不重复」的竖屏视频。

## 2. 目录

| 位置 | 放什么 |
|---|---|
| `config/pipeline.json` | 主配置：规格、素材根、生成 preset、混剪节拍 |
| `run.mjs` | 一键入口：`scan / creative / quality / mix / all / stills / check` |
| `modules/scan` | 扫描、增量、打标、场景切分、缩略图 |
| `modules/generate` | 共享目录与渲染工具：catalog、props、reindex、静帧 |
| `modules/creative` | 创意工程：引擎 schema、参数校验、编译、渲染、审核 |
| `creative` | 创意内容包（gitignore）：引擎实现 + 项目/变体；`registry.ts` 由初始化或 scan 生成 |
| `modules/quality` | pHash、观感相似度、感知聚类、覆盖矩阵、质量闸门 |
| `modules/mix` | EDL 规划、去重、渲染 |
| `modules/lib` | 配置、ffmpeg、public 链接、Remotion 封装 |
| `workbench` | 本地 Web 工作台：素材/成片/质量浏览、任务队列、实时日志 |
| `projects` | 具体成片项目：TTS、分镜脚本、混音与项目说明 |
| `src` | Remotion composition：`PipelineAsset`、`MixVideo`、通用类型（`types.ts` 只放 `EngineProps / PresetMeta / AssetProps`） |
| `common` | 上游资源快照：只剩 `engine/` 与 `vendor/` |
| `assets` | 素材库（内容部署，gitignore；`config/pipeline.json` 的 `assets.roots` 可配多根） |
| `data` | 运行产物：素材库、目录、EDL、签名库（gitignore） |
| `out` | 生成素材、静帧、分段、成片（gitignore） |
| `public` | 渲染静态根，运行时自动建链接（gitignore） |
| `docs` | 规则、经验、流程、模块、依赖、决策、排错 |
| `tools` | 体检与内容同步：`doctor`、`check`、`assets`、`sync`、`projects` |

## 3. 六条硬规则

1. **实拍是事实，生成是示意。** 生成片段不能冒充实拍；手机 UI 等示意画面必须带「示意」标记。品牌图标只作类别示意，不表示合作或背书。
2. **确定性。** `src/` 里的动画只能由 `useCurrentFrame()` / `useVideoConfig()` 推导；禁止 `Date.now`、`new Date`、`Math.random`。随机用 `keyedRandom(seed, key)` 或 Canvas 引擎的 `rng(seed)`。`npm run check` 会扫。
3. **不自己发明素材。** 图标、字体、地图、音乐、镜头卡、动效实现，先用已有清单与 `common/`；新增二进制素材必须用 `node tools/assets.mjs scan --apply` 登记到 `creative/shared/assets.manifest.json` 并更新 `creative/shared/CREDITS.md`。素材二进制与清单都不进核心仓库，通过 `npm run assets:fetch` 或用户目录部署。许可不清楚的素材不用。
4. **配置优先。** 路径、规格、preset、节拍、时长都通过 `config/pipeline.json` 或 CLI 参数指定；不要把作品参数硬编码进模块。
5. **先查现成，再写。** 顺序：Remotion 官方包 → 成熟第三方库 → `common/vendor` / `common/engine` → 自己写。新依赖必须先登记 `docs/dependencies.json`，否则 `check` 失败。
6. **先有主题，再动手。** 每次出片先能用一句话说清「这条片子讲什么画面」。删掉后画面不受影响的内容，就是叠加，应当删除。

## 4. 数据契约

- `data/footage.manifest.json`：全量素材索引，含 `status: active | missing`。
- `data/library.json`：给模块三用的活跃素材数组，含 `scenes[]`、`tags`、`crop`、`publicSrc`。
- `data/catalog.json`：生成素材目录，含 `publicMp4`、`publicWebm`、`props`、`duration`、`quality`；创意图材另有 `creativeId / variantId / creativeVersion / paramsHash`。
- `data/quality/report.json`：质量与覆盖报告；`out/quality/report.md`：人读版。
- `data/edl/mix-*.json`：成片时间线；`beats[]` 是叙事窗口，镜头可跨节拍，`beats[].shots[]` 允许为空。`data/edl/signatures.json`：跨成片去重记录。
- `out/assets`：生成素材；`out/stills`：静帧；`out/segments`：分段；`out/mix-*.mp4`：成片。

不要手改 `data/` 里的自动产物；要改就改配置或源码，然后重跑对应 stage。

## 5. 经验制度

每次任务结束必须留痕：

1. `STATUS.md`：当前状态、最近验证、待办。
2. `docs/LESSONS.md`：只追加，不删除。模板：日期 / 现象 / 原因 / 修法 / 预防。
3. `docs/DECISIONS.md`：影响架构或流程的选择，写清背景、选项、结论、代价。
4. `docs/MODULES.md`：新增或修改 preset/模块后更新。
5. `docs/DEPENDENCIES.md` + `docs/dependencies.json`：新增依赖后同步。
6. `creative/shared/CREDITS.md` + `creative/shared/assets.manifest.json`：新增素材后同步（`node tools/assets.mjs scan --apply`）。

新会话不要求记住上一个会话，只要求按这套文档恢复上下文。

## 6. 常用命令

```bash
npm run doctor
npm run workbench
node run.mjs all
node run.mjs scan --check
node run.mjs sync --check
node run.mjs sync --apply
node run.mjs projects scan
npm run assets:scan
npm run assets:check
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

`common/` 是核心里的上游资源快照，只剩两棵子树：

- `common/engine` 是共享运动/字体/Canvas 原语（字体清单不在这里，见 `creative/shared/fonts.ts`）；
- `common/vendor` 是第三方/上游实现；
- 素材库是独立的 `assets/`（gitignore，`config/pipeline.json` 的 `assets.roots` 可配多根，按顺序合并；清单在 `creative/shared/assets.manifest.json`），不属于核心源码；镜头卡与素材许可在 `creative/shared/`。

不要在 `common/` 里直接实现业务逻辑，也不要往核心提交具体创意实现。升级上游时整目录替换 `common/{engine,vendor}`，然后跑 `npm run sync -- --check`、`npm run doctor`、`npm run typecheck`、`node run.mjs creative build --force` 验证。

## 9. 不确定时

- 规格、时长、受众不清楚：先问，不猜。
- 素材许可不清楚：不用，换素材或问用户。
- 要改公共层：先看 `docs/MODULES.md`，能组合就不新增。
- 要新增/修改生成素材：先看 `docs/ASSETS.md`；声明 `category`，保证动画完整（循环闭合 / 末帧稳定 / 转场回透明），跑 `node run.mjs quality --force`。
- 裂变默认只复用 shared 素材库；需要作品专属素材时才加 `--with-assets`，不要默认生成。
- 要新增依赖：先看 `docs/DEPENDENCIES.md` 的候选表，走 3 帧确定性测试后再登记。
