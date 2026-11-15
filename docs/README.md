# DOCS · 索引与治理

文档按**功能**分类，一类一个目录；每个主题只有一份权威文档。新增文档前先确认不能并入现有文件。

## 目录

| 目录 | 放什么 | 权威文档 |
|---|---|---|
| `architecture/` | 系统如何组成、各层边界与契约 | `ARCHITECTURE.md`、`SHARED.md`、`CREATIVE.md`、`ASSETS.md`、`AUDIO.md` |
| `operations/` | 怎么跑、怎么排错、怎么发布 | `WORKFLOW.md`、`WORKBENCH.md`、`FISSION.md`、`QUALITY.md`、`DEPENDENCIES.md`、`TROUBLESHOOTING.md` |
| `reference/` | 细则与素材库 | `RULES.md`、`MOTION_PROMPTS.md` |
| `records/` | 当前有效规则与记录索引（默认阅读面） | `LESSONS.md`（坑位清单）、`DECISIONS.md`（ADR 索引） |
| `archive/` | 历史归档，**默认不读** | `STATUS-HISTORY.md`、`LESSONS-HISTORY.md`、`DECISIONS-ADRS.md` |

根目录文档：`CLAUDE.md`（入口与硬规则）、`README.md`（部署与总览）、`STATUS.md`（当前状态，历史已归档）、`CREDITS.md`（核心代码许可）。

## 每个文档的职责

| 文档 | 回答什么问题 | 什么时候更新 |
|---|---|---|
| `architecture/ARCHITECTURE.md` | 系统分几层、模块在哪、数据怎么流 | 新增/删除模块、改变分层 |
| `architecture/SHARED.md` | 公共资源与素材库怎么组织、谁负责、怎么初始化与校验 | 改 `shared/` 结构或命令 |
| `architecture/CREATIVE.md` | 创意工程的文件格式、引擎契约、构建语义 | 改引擎 schema、工程格式 |
| `architecture/ASSETS.md` | 生成素材的分类、完整性、质量契约 | 改 category / 完整性规则 |
| `architecture/AUDIO.md` | 音效与 BGM 来源、选曲、落点 | 改音频索引或落点规则 |
| `operations/WORKFLOW.md` | 从环境到出片的操作顺序、常见任务 | 改命令或流程步骤 |
| `operations/WORKBENCH.md` | 工作台页面与 API | 改工作台 |
| `operations/FISSION.md` | 裂变作品的隔离、缓存、清理 | 改 fission |
| `operations/QUALITY.md` | pHash、相似度、聚类、覆盖矩阵 | 改质量层 |
| `operations/DEPENDENCIES.md` | 依赖政策与已安装清单 | 增删依赖 |
| `operations/TROUBLESHOOTING.md` | 故障现象与修法 | 遇到新坑 |
| `reference/RULES.md` | 细则（确定性、素材、渲染闸门等） | 改规则 |
| `reference/MOTION_PROMPTS.md` | 动效提示词库 | 新增动效模式 |
| `records/LESSONS.md` | 仍然有效的坑（精简清单） | 每次任务结束追加一条规则 |
| `records/DECISIONS.md` | ADR 索引与状态 | 新增决策时加一行 |

## 新增与修改规则

1. **先查后写**：先看本索引与对应权威文档，能补进现有文件的，不新建文件。
2. **一个主题一个文件**：同一事实只在一处维护；其他文档用链接指向它，不复制内容。
3. **按类别放**：架构进 `architecture/`，操作进 `operations/`，规则与素材库进 `reference/`；不要放在 `docs/` 根目录。
4. **不按会话建文档**：一次任务的进展写进 `STATUS.md`；结束后的会话记录追加到 `archive/STATUS-HISTORY.md`，不新增 `NOTES-<date>.md`。
5. **历史只进 archive**：已完成的计划、被替代的方案移入 `archive/`；`archive/` 默认不读，只有追溯问题时用 `grep` 搜索。
6. **记录分两层**：新的坑先按“现象/原因/修法/预防”追加到 `archive/LESSONS-HISTORY.md`，再把一条可执行规则写进 `records/LESSONS.md`；新的决策全文追加到 `archive/DECISIONS-ADRS.md`，`records/DECISIONS.md` 只加一行索引与状态。`records/` 保持小，`archive/` 只增不减。
7. **链接用仓库相对路径**：`docs/architecture/SHARED.md`，不要用绝对路径或只在某个目录有效的相对路径。
8. **代码同步**：改模块/命令/配置时，同一次改动里更新对应文档；`npm run check` 会校验必读文档是否存在。
9. **不写空话**：文档只写约束、格式、命令、示例；不写“我们以后可能会……”式的设想。

## 默认阅读面

新会话只需要：`STATUS.md` → 本文件 → `reference/RULES.md` → 与任务相关的 `architecture/` 文档。
`records/LESSONS.md` 是短清单，可整读；`records/DECISIONS.md` 是索引，按需打开单条。
`archive/` 与 `records/` 里的全文都不默认读，避免上下文膨胀。

Agent 与人类使用同一套命令与闸门；写区、标准循环、机器可读自检与 Done 定义见
[operations/WORKFLOW.md](operations/WORKFLOW.md) 第 12 节「Agent 协作」。`shared/shots` 是可选创意参考，
不参与运行时，也不默认读取。

## 防止混乱的自检

提交前问自己：

- 这条信息是否已有权威位置？没有才新增。
- 新文档能否并进现有文件？能并就不新建。
- 是否把同一规则复制到了第二处？改成链接。
- 是否把一次性进展写进了架构文档？应该进 `STATUS.md`。
