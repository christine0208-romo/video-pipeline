# PLAN · 资源管理与资源市场

> 临时计划，完成一个阶段更新一次；全部完成后删除。当前系统只解决“资源进来之后怎么记账”，本计划补齐“从哪来、够不够、怎么可视化”。

## 0. 边界

- 素材（图标/字体/音效/BGM/图片/视频）与创作物（动效引擎/组件库）分开处理：素材走下载→校验→登记；创作物走创意包安装＋人工审核。
- 市场只提供目录与下载地址，导入仍复用 `assets add`；不把内容二进制或市场目录提交进核心仓库。
- 下载内容视为不可信输入：限制类型/大小，SVG 清洗，不执行下载代码。
- 许可一等公民：自动记录 `license/source/attribution`；`unknown` 不阻断，但发布前集中提示。
- 固定版本与哈希；不做自动更新，保证可复现。

## 0.1 版本与分支

一个阶段 = 一个小版本 = 一个 `feat/*` 分支；合并 `main` 后打 tag。开发期默认 `0.0.x`，阶段稳定点用 `0.y.0`，正式发行才用 `1.0.0`。

| 阶段 | 版本 | 分支 |
|---|---|---|
| 当前开发基线 | `v0.0.1` | 直接进入 `main` |
| Phase 1 本地资源管理与检查 | `v0.1.0` | `feat/resource-manager` |
| Phase 2 目录契约与只读 provider | `v0.2.0` | `feat/resource-market` |
| Phase 3 音效/图片/视频与许可看板 | `v0.3.0` | `feat/resource-providers` |
| Phase 4 市场目录与私有源 | `v0.4.0` | `feat/market-catalog` |
| 插件系统（未排期） | `v0.5.0` | `feat/plugin-system` |
| 正式发行版（未排期） | `v1.0.0` | `release/1.0` |

规则见 `docs/operations/WORKFLOW.md` 第 13 节。

## 1. Phase 1 · 本地资源管理与检查（无网络）

1. 工作台新增“资源”页：
   - 本地清单：按 kind 浏览，预览（图片缩略图、音频波形/时长）、许可状态、缺失/未登记；
   - 元数据编辑：调用 `audio set`、`font set` 的等价能力；
   - 导入队列：拖入文件/目录，复用 `assets add`，显示进度与日志。
2. `assets check --licenses`：列出 `license=unknown`、缺署名字段、音频缺 `mood/energy/category`、字体缺 `family/weight` 的条目。
3. 内容包 `requirements.json`（内容侧声明，允许手改）：声明需要的字体族、音频类别、图标集；`shared requirements --check` 按角色报告缺口。

验收：工作台能看清“有什么、缺什么、许可是否齐全”；一条命令列出待补元数据。

## 2. Phase 2 · 目录契约与只读 provider

1. 定义 catalog 条目：`id/kind/name/tags/license/source/url/sha256/preview/version`。
2. 接入两个只读 provider：Iconify（图标）、Google Fonts（字体）。
3. 一键导入：下载到缓存 → 校验哈希/类型 → 复制到素材根 → 登记清单/字体清单；记录 lock（来源、版本、哈希）。
4. API key 放 `config/local.json`，无 key 的 provider 默认禁用。

验收：工作台搜索 → 预览 → 导入 → `shared validate --strict` 通过；断网时用 lock 与缓存复现。

## 3. Phase 3 · 音效/图片/视频与许可看板

1. 接入 Kenney、AERIS（CC0 直链）、Freesound（API key，逐条许可）、Openverse/Pixabay/Pexels。
2. 许可看板：按 CC0 / CC BY / 自定义分组，列出必须署名的素材。
3. 导入前展示许可与署名要求，用户确认后才下载。

## 4. Phase 4 · 市场目录与私有源

1. 市场目录用静态 JSON + CDN 提供；团队私有源同一契约。
2. 创作物（动效/组件）以创意包形式分发：`engine.json`、`index.tsx`、变体、预览、版本、许可，导入前审核。
3. 不做：自动执行远程代码、自动升级素材、抓取许可不明的站点。

## 5. 后续候选（未排期）

- 系统插件系统：允许在工作台/命令行挂载外部能力（provider、导出器、审核器），插件清单、权限与版本隔离单独立项，作为 `v2.x` 小版本推进。
- 市场服务端与团队私有源：在 Phase 4 契约稳定后再做独立服务，不放进本仓库。

## 6. 相关文档

- 规范：`docs/architecture/SHARED.md`（清单、字体、音频、记账/创作文件）、`docs/architecture/AUDIO.md`（音频索引）。
- 工作台：`docs/operations/WORKBENCH.md`。
- 规则：`docs/reference/RULES.md`。
