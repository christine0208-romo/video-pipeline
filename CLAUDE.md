# CLAUDE.md · video-pipeline 工作区

这是一个独立的「实拍素材 + 生成动效素材 → 混剪成片」工作区。新会话先按第 0 节自检，再动手。

## 0. 开工顺序（硬流程）

1. 读 `STATUS.md`、`docs/LESSONS.md`、`docs/RULES.md`。
2. 跑 `npm run doctor`；缺依赖、ffmpeg、浏览器、素材根目录，先修再继续。
3. 看 `config/pipeline.json` 的 `footage.roots`、`spec`、`generate.presets`、`mix`。
4. 素材有变化先 `node run.mjs scan`；生成素材有变化先 `node run.mjs generate`。
5. 出片走 `node run.mjs mix`；它会先出静帧、再分 3 段抽帧、最后全片。
6. 收尾：
   - 更新 `STATUS.md`；
   - 有新坑追加 `docs/LESSONS.md`；
   - 新组件登记 `docs/MODULES.md`；
   - 新依赖登记 `docs/dependencies.json` 与 `docs/DEPENDENCIES.md`；
   - 新素材/字体/图标更新 `CREDITS.md` 与 `common/assets/REGISTRY.json`；
   - 跑 `npm run check` 和 `npm run typecheck`。

## 1. 一句话定位

把实拍素材扫描成可检索的镜头库，生成可叠加的动效素材，再自动混剪成「同素材而画面不重复」的竖屏视频。

## 2. 目录

| 位置 | 放什么 |
|---|---|
| `config/pipeline.json` | 主配置：规格、素材根、生成 preset、混剪节拍 |
| `run.mjs` | 一键入口：`scan / generate / mix / all / stills / check` |
| `modules/scan` | 扫描、增量、打标、场景切分、缩略图 |
| `modules/generate` | 生成素材目录、变体、渲染调度 |
| `modules/mix` | EDL 规划、去重、渲染 |
| `modules/lib` | 配置、ffmpeg、public 链接、Remotion 封装 |
| `src` | Remotion composition：`PipelineAsset` 与 `MixVideo` |
| `src/generated` | 6 个 preset、注册表、图标清单 |
| `common` | 上游资源快照：engine / components / vendor / assets / shots |
| `data` | 运行产物：素材库、目录、EDL、签名库（gitignore） |
| `out` | 生成素材、静帧、分段、成片（gitignore） |
| `public` | 渲染静态根，运行时自动建链接（gitignore） |
| `docs` | 规则、经验、流程、模块、依赖、决策、排错 |
| `tools` | `doctor.mjs` 环境体检、`check.mjs` 工作区体检 |

## 3. 六条硬规则

1. **实拍是事实，生成是示意。** 生成片段不能冒充实拍；手机 UI 等示意画面必须带「示意」标记。品牌图标只作类别示意，不表示合作或背书。
2. **确定性。** `src/` 里的动画只能由 `useCurrentFrame()` / `useVideoConfig()` 推导；禁止 `Date.now`、`new Date`、`Math.random`。随机用 `keyedRandom(seed, key)` 或 Canvas 引擎的 `rng(seed)`。`npm run check` 会扫。
3. **不自己发明素材。** 图标、字体、地图、音乐、镜头卡、动效实现，先用 `common/` 里已有的；新增素材必须登记 `common/assets/REGISTRY.json` 并写入 `CREDITS.md`。许可不清楚的素材不用。
4. **配置优先。** 路径、规格、preset、节拍、时长都通过 `config/pipeline.json` 或 CLI 参数指定；不要把作品参数硬编码进模块。
5. **先查现成，再写。** 顺序：Remotion 官方包 → 成熟第三方库 → `common/vendor` / `common/components` → 自己写。新依赖必须先登记 `docs/dependencies.json`，否则 `check` 失败。
6. **先有主题，再动手。** 每次出片先能用一句话说清「这条片子讲什么画面」。删掉后画面不受影响的内容，就是叠加，应当删除。

## 4. 数据契约

- `data/footage.manifest.json`：全量素材索引，含 `status: active | missing`。
- `data/library.json`：给模块三用的活跃素材数组，含 `scenes[]`、`tags`、`crop`、`publicSrc`。
- `data/catalog.json`：生成素材目录，含 `publicMp4`、`publicWebm`、`props`、`duration`。
- `data/edl/mix-*.json`：成片时间线；`data/edl/signatures.json`：跨成片去重记录。
- `out/assets`：生成素材；`out/stills`：静帧；`out/segments`：分段；`out/mix-*.mp4`：成片。

不要手改 `data/` 里的自动产物；要改就改配置或源码，然后重跑对应 stage。

## 5. 经验制度

每次任务结束必须留痕：

1. `STATUS.md`：当前状态、最近验证、待办。
2. `docs/LESSONS.md`：只追加，不删除。模板：日期 / 现象 / 原因 / 修法 / 预防。
3. `docs/DECISIONS.md`：影响架构或流程的选择，写清背景、选项、结论、代价。
4. `docs/MODULES.md`：新增或修改 preset/模块后更新。
5. `docs/DEPENDENCIES.md` + `docs/dependencies.json`：新增依赖后同步。
6. `CREDITS.md` + `common/assets/REGISTRY.json`：新增素材后同步。

新会话不要求记住上一个会话，只要求按这套文档恢复上下文。

## 6. 常用命令

```bash
npm run doctor
node run.mjs all
node run.mjs scan --check
node run.mjs generate --only platform-orbit --variants 1
node run.mjs mix --duration 15 --outputs 2 --seed 20261108
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

`common/` 是从上游工作区搬来的资源快照，保持原目录关系：

- `common/engine` → `common/vendor`；
- `common/components/reel/v2` → `common/engine`、`common/vendor`；
- `common/assets/fonts` 通过 `public/assets` 链接供 `staticFile` 使用；
- `common/shots` 是镜头卡文档，不是运行时代码。

不要在 `common/` 里直接实现业务逻辑。需要升级上游时，整目录替换 `common/{engine,components,vendor,assets,shots}`，然后跑 `npm run doctor`、`npm run typecheck`、`node run.mjs generate --variants 1 --force` 验证。

## 9. 不确定时

- 规格、时长、受众不清楚：先问，不猜。
- 素材许可不清楚：不用，换素材或问用户。
- 要改公共层：先看 `docs/MODULES.md`，能组合就不新增。
- 要新增依赖：先看 `docs/DEPENDENCIES.md` 的候选表，走 3 帧确定性测试后再登记。
