# PLAN · 资源管理与资源市场

> 临时计划，完成一个阶段更新一次；全部完成后删除。当前系统只解决“资源进来之后怎么记账”，本计划补齐“从哪来、够不够、怎么可视化”。

## 0. 边界

- 素材（图标/字体/音效/BGM/图片/视频）与创作物（动效引擎/组件库）分开处理：素材走下载→校验→登记；创作物走创意包安装＋人工审核。
- 市场只提供目录与下载地址，导入仍复用 `assets add`；不把内容二进制或市场目录提交进核心仓库。
- 下载内容视为不可信输入：限制类型/大小，SVG 清洗，不执行下载代码。
- 许可一等公民：自动记录 `license/source/attribution`；`unknown` 不阻断，但发布前集中提示。
- 固定版本与哈希；不做自动更新，保证可复现。

## 0.1 版本与分支

一个阶段 = 一个小版本 = 一个 `feat/*` 分支；合并 `main` 后打 tag。功能升级未结束前保持 `0.0.x`，只有明确宣布稳定点才用 `0.y.0`，正式发行才用 `1.0.0`。

| 阶段 | 版本 | 分支 |
|---|---|---|
| 当前开发基线 | `v0.0.2` | 直接进入 `main` |
| Phase 2 目录契约与只读 provider | `v0.0.3` | `feat/resource-market` |
| Phase 3 音效/图片/视频与许可看板 | `v0.0.4` | `feat/resource-providers` |
| Phase 4 市场目录与私有源 | `v0.0.5` | `feat/market-catalog` |
| 插件系统（未排期） | `v0.0.6` | `feat/plugin-system` |
| 稳定点（未排期，由用户宣布） | `v0.1.0` | `release/0.1` |
| 正式发行版（未排期） | `v1.0.0` | `release/1.0` |

规则见 `docs/operations/WORKFLOW.md` 第 13 节。

## 1. Phase 1 · 本地资源管理与检查（已完成，v0.0.2）

- [x] 工作台“资源”页：清单 / 字体 / 音乐 / 音效，kind 标签、搜索、图片缩略图、音频试听、许可与元数据编辑、路径导入队列。
- [x] `assets check --json|--licenses|--meta`：缺失、未登记、哈希、许可未知、字体/音频元数据缺失。
- [x] `shared/requirements.json` + `shared requirements [--json] [--strict]`：字体族、音效类别、BGM 情绪、kind 数量缺口。
- [x] 概览中的模块状态卡片：scan / creative / quality / mix / fission / sync / shared 的计数、状态、最近任务与只读检查。
- [x] 工具任务白名单与参数校验；`/media/assets/*` 只读素材媒体。

验收：资源页能看清“有什么、缺什么、许可/元数据是否齐全”；一条命令输出结构化缺口；概览可发起只读检查。

后续可加：拖拽导入、音频波形、批量编辑、资源使用位置统计。

## 2. Phase 2 · 目录契约与只读 provider（已完成，v0.0.3）

- [x] catalog 条目契约（`id/kind/name/prefix/collection/license/source/url/preview/fileName`）。
- [x] Iconify 只读 provider：搜索、图标集许可元数据、24h 缓存。
- [x] 市场并入资源页：本地资源 / 在线市场两种模式。
- [x] 来源管理：默认值在 `config/pipeline.json` 的 `market.defaults`、来源在 `config/local.json`；`market.mjs providers list/add/set/remove`，工作台可添加/编辑/停用/移除。
- [x] 市场入口：类别目录（类别与数量来自来源自身目录）+ 搜索；推荐集与快捷搜索词已移除。
- [x] 推荐图标集可进入完整集合：集合内搜索、分页加载。
- [x] 资源移除：`assets remove` 自动取消清单/音频索引登记，同步 `fonts.ts` 与 CREDITS；工作台提供删除文件/仅取消登记。
- [x] 样张只打开预览；导入显式确认，显示目标路径与已导入状态，重复导入按清单路径去重。
- [x] 一键导入：服务端重新解析 `prefix:name`，复用 `assets add`，写入清单与 CREDITS。
- [x] Google Fonts provider：目录/搜索/许可以 `catalogUrl` 为配置项（默认 Fontsource 镜像），字体文件按字族+字重从 CSS2 解析 `woff2`；导入复用 `assets add`，自动更新清单、`fonts.ts`、CREDITS；推荐模板在 `config/local.example.json`；资源页以类别目录为主入口，搜索结果可返回目录。
- [x] lock/版本固定：清单即锁（`path/size/sha256/url/license/source` + `provider/providerRef`），`assets fetch` 下载后校验哈希；不另建 lock 文件。
- [x] 市场缓存：TTL 对齐上游（Iconify 7 天）+ 304 条件检查 + 集合详情缓存 + 图标预览本地缓存与限流队列，失败沿用旧缓存并择机重试。

当前改动在分支 `feat/resource-market`，版本 `0.0.3`；Phase 2 完成。

验收：资源页切换本地/市场 → 来源增删改 → 推荐或搜索 → 导入 → `shared validate --strict` 通过；断网时本地资源管理不受影响。

## 3. Phase 3 · 音效/图片/视频与许可看板

1. 接入 Kenney、AERIS（CC0 直链）、Freesound（API key，逐条许可）、Openverse/Pixabay/Pexels。
2. 许可看板：按 CC0 / CC BY / 自定义分组，列出必须署名的素材。
3. 导入前展示许可与署名要求，用户确认后才下载。

## 4. Phase 4 · 市场目录与私有源

1. 市场目录用静态 JSON + CDN 提供；团队私有源同一契约。
2. 创作物（动效/组件）以创意包形式分发：`engine.json`、`index.tsx`、变体、预览、版本、许可，导入前审核。
3. 不做：自动执行远程代码、自动升级素材、抓取许可不明的站点。

## 5. 插件层：暂不实现（结论）

- 没有跨宿主通用的插件契约；第三方插件必须按宿主契约开发，现成生态里没有本系统的插件。
- 自造通用插件框架（manifest + 加载器 + 权限 + 版本兼容 + 市场审核）成本高、收益低，当前不实现。
- 保留现有轻量扩展点：市场 provider 适配器（`type` + `config/local.json`）、配置驱动、第三方库/SDK 在适配器内复用。
- 只有出现明确的第三方插件需求（团队要安装自定义 provider/钩子）时，再选一个宿主标准迁移：MCP（AI 工具/资源）、oclif（CLI）、Fastify（服务端）。不做投机性实现。

## 6. 后续候选（未排期）

- 市场服务端与团队私有源：在 Phase 4 契约稳定后再做独立服务，不放进本仓库。

## 7. 相关文档

- 规范：`docs/architecture/SHARED.md`（清单、字体、音频、记账/创作文件）、`docs/architecture/AUDIO.md`（音频索引）。
- 工作台：`docs/operations/WORKBENCH.md`。
- 规则：`docs/reference/RULES.md`。
