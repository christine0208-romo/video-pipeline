# WORKBENCH · 本地可视化工作台

一个只绑定 `127.0.0.1` 的本地 Web 页面，用来浏览素材、看成片、运行 `run.mjs` 阶段、查看质量报告。不重写流水线，只包一层任务队列和文件浏览；没有新增 npm 依赖。

## 1. 启动

```bash
npm run workbench
# 或自动打开浏览器
npm run workbench:open
```

默认地址：`http://127.0.0.1:4317/`。端口可改：

```bash
node workbench/server.mjs --port 4400 --open
```

## 2. 页面

| 页面 | 内容 |
|---|---|
| 概览 | 实拍/生成素材数、作品数、成片数、当前任务、最近成片、质量摘要；模块状态卡片（scan / creative / quality / mix / fission / sync / shared 的计数、状态与最近任务，可发起只读检查） |
| 资源 | 本地资源 / 在线市场两种模式。本地：按素材清单实际 kind 动态生成分类（全部素材、字体、图标、图片、地图、音乐、音效……），支持搜索、图片缩略图、音频长进度条试听、字体样张预览、许可/元数据编辑、导入、移除（删除文件或仅取消登记）、问题与 requirements 缺口。市场：来源管理（Iconify / Google Fonts）、类别目录、搜索、按类别浏览图标集与字族、浏览全部、集合/字族内搜索与分页；样张只预览，导入显式确认并显示目标路径与已导入状态；搜索结果可一键返回目录 |
| 素材 | 生成素材与实拍素材；按层 / 类型 / scope / 状态筛选；默认隐藏退役素材；可按系列分组查看变体；缩略图、静帧、视频预览（实拍通过受控路由播放）；批准 / 退役 / 提升 shared / 清理 work（dry-run）。类型、状态、质量标记用中文展示。 |
| 创意 | 创意工程与变体列表；参数控件由 `creative/engines/*.json` 或本地 `engine/engine.json` 生成；逐条编辑文案；保存、预览静帧、构建、批准/退役。构建默认作用于当前变体，每个 item 与产物行也有单独的构建/预览按钮。 |
| 任务 | 选择 scan / quality / mix / fission / check，填参数、预览命令、运行、看实时日志、取消；创意构建在“创意”页触发 |
| 成片 | 列表、内嵌播放器、时长/镜头数/大小、打开所在文件夹、复制路径 |
| 质量 | 复用 `data/quality/report.json` 的聚类、近似重复、覆盖矩阵与质量标记 |

界面约定：侧栏固定、主区域内部滚动（app-shell）；时间统一显示为 `YYYY-MM-DD HH:mm:ss`；枚举标签与悬浮说明来自 `config/workbench.json` 的 `labels`；侧栏底部“预览底色”可切换深色 / 浅色 / 棋盘，用于黑色素材和透明素材预览。

## 3. 任务队列

- 一次只跑一个任务；Remotion 不能并发。
- 后续任务进入队列，当前任务结束后自动开始。
- 日志写入 `data/workbench/logs/<jobId>.log`，通过 SSE 实时推到页面；刷新页面后仍可回看。
- 「取消」会终止整个子进程树（Windows 用 `taskkill /T /F`）。
- 服务重启时，正在运行/排队的任务标记为 `interrupted`，不会自动续跑；已渲染素材仍按文件缓存，重跑会跳过已有文件。

任务只是拼参数调用：

```text
node run.mjs <stage> <args...>
```

任务表单的字段说明写在 `config/workbench.json` 的 `stages.*.fields[].hint`，界面用 `?` 与 `title` 悬浮展示；质量指标同样带悬浮说明。

资源页的导入、扫描、字体/音频元数据会通过同一队列调用白名单工具：

```text
node tools/assets.mjs add|scan|audio|font ...
node run.mjs shared fonts --write
```

因此 CLI 的缓存、质量闸门、确定性规则全部保持不变。

## 4. API

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/status` | 计数、当前任务、队列、最近成片、质量摘要 |
| GET | `/api/catalog` | 生成素材目录（含 quality、stills、mp4/webm URL） |
| GET | `/api/library` | 实拍素材库 |
| GET | `/api/outputs` | `out/*.mp4` 与对应 EDL 摘要 |
| GET | `/api/quality` | 质量报告 + `catalogCount`（用于提示报告是否过期） |
| GET | `/api/resources` | 本地资源视图：清单、字体、音频索引、问题、requirements、媒体 URL |
| GET | `/api/labels` | 枚举标签与悬浮说明（`config/workbench.json` 的 `labels`） |
| GET | `/api/market/providers` | 市场 provider 列表 + 中性默认值（`config/pipeline.json` 的 `market.defaults`）+ 来源模板（`config/local.example.json`）；来源在 `config/local.json` |
| POST | `/api/market/providers` | `{ action: add/set/remove, id, type, baseUrl, catalogUrl?, subset?, ... }`，入队 `market.mjs providers` 维护来源 |
| GET | `/api/market/search` | `provider=id&q=...&limit=24`，返回目录条目（图标或字体变体） |
| GET | `/api/market/collection` | `provider=id&prefix=...&q=...&offset=...&limit=...`，浏览整图标集或字族的全部变体 |
| GET | `/api/market/browse` | `provider=id&category=...&q=...&offset=...&limit=...`，返回类别统计并按类别浏览图标集或字族 |
| GET | `/media/market/icon` | `provider=id&prefix=...&name=...`，图标预览本机缓存；未缓存时经限流队列拉取 |
| POST | `/api/market/import` | `{ icon: "prefix:name" | "family-id:weight", provider? }`，服务端重新解析后入队 `assets add` |
| POST | `/api/resources/import` | 入队 `assets add`：`{ paths[], keep, kind, license, source }` |
| POST | `/api/resources/meta` | 入队 `font set` / `audio set`：字体或音频元数据 |
| POST | `/api/resources/scan` | 入队 `scan --apply` / `audio scan --apply` / `shared fonts --write` |
| POST | `/api/resources/remove` | `{ path, keepFile? }`，入队 `assets remove`，自动取消清单/索引登记 |
| GET | `/api/modules` | 流水线各模块的计数、状态与最近任务 |
| GET | `/api/creative` | 创意工程、引擎 schema、变体、产物与构建状态 |
| POST | `/api/creative/:id/variant/:vid` | 保存变体参数 / items / 状态；校验后原子写回 |
| POST | `/api/creative/:id/build` | 入队 `creative build` |
| POST | `/api/creative/:id/preview` | 入队 `creative preview`，静帧到 `out/creatives/` |
| POST | `/api/creative/:id/review` | 入队 `creative review`，批准 / 退役 |
| GET | `/api/jobs` | 任务列表、当前任务、队列 |
| POST | `/api/jobs` | `{ stage, args[] }` 创建任务 |
| GET | `/api/jobs/:id` | 单个任务状态 |
| GET | `/api/jobs/:id/stream` | SSE：历史日志 + 实时日志 + 状态 |
| POST | `/api/jobs/:id/cancel` | 取消任务 |
| POST | `/api/action` | `{ action, id }`：approve / reject / share / clean-work |
| POST | `/api/reveal` | 在文件管理器中显示 `out/` 或 `data/` 下的路径 |
| GET | `/media/out/*`、`/media/data/*` | 静态媒体；支持 Range，供视频拖动播放 |
| GET | `/media/assets/*` | 素材根只读媒体；限制在 `assets.roots` 内，支持 Range |
| GET | `/media/footage/:id` | 实拍素材播放；按 library id 查找并限制在 `footage.roots` 内，支持 Range |

标签与说明集中在 `config/workbench.json` 的 `labels`（category / layer / status / qualityFlag / jobStatus / stage / matrix / resourceKind / resourceTab / resourceMode / beat / action / qualityMetric）。工作台通过 `/api/labels` 读取，`npm run check` 校验结构与必需分组；`label` 必填，`hint` 按需添加，不需要说明的条目省略即可。

## 5. 安全边界
- 只监听 `127.0.0.1`，不对外网开放。
- 命令用 `spawn(process.execPath, [run.mjs, stage, ...args])`，不经过 shell。
- `stage` 有白名单；参数必须是字符串数组。
- 资源工具任务只允许 `tools/assets.mjs`、`tools/market.mjs` 与 `run.mjs`，参数由服务端按动作拼装；用户输入以 `-` 开头时拒绝，避免被当成命令行参数。
- 市场导入不信任客户端 URL：只接受 `prefix:name`（图标）或 `family-id:weight[-italic]`（字体），服务端重新解析目录条目后调用 `assets add`；下载内容按不可信输入处理。
- 市场来源的增删改通过 `tools/market.mjs providers ...` 写入 `config/local.json` 的 `market.providers`，工作台只入队该命令；`config/pipeline.json` 的 `market.defaults` 只放缓存与条数，来源模板来自 `config/local.example.json`，添加来源时预填、用户可改。
- 导入后 `assets add` 会自动更新清单、音频索引、字体清单（字体）与 `shared/CREDITS.md`。
- `/media/*` 与 `/api/reveal` 只允许 `out/`、`data/` 下的路径，拒绝 `..` 穿越；`/media/assets/*` 只允许 `assets.roots` 下已存在的文件；`/media/footage/:id` 只按 library id 解析，并限制在 `footage.roots` 内。

## 6. 边界与后续

- Windows 上浏览器预览会占用 `out/*.mp4` 的文件句柄。工作台会在提交任务、关闭弹窗、离开成片页时释放所有 `<video>`，并且媒体流在客户端断开时销毁；通过 API 直接提交任务不会自动释放，需调用方自己保证。
- `clean-work` 在工作台里只做 dry-run；真正删除仍需命令行 `--force`。
- 质量页只读报告；过期时提示「报告待更新」，不会自动重算。
- 还没有发布/上传功能。下一步可加：批次任务表、发布打包（`release/<batch>/` + manifest + 封面 + CSV）、平台上传（需要单独评估授权与风险）。
- 工作台不替代 `npm run check` / `npm run typecheck`；提交前仍要跑。
