# DOCS · 索引与治理

文档按**功能**分类，一类一个目录；每个主题只有一份权威文档。新增文档前先确认不能并入现有文件。

## 目录

| 目录 | 放什么 | 权威文档 |
|---|---|---|
| `architecture/` | 系统如何组成、各层边界与契约 | `ARCHITECTURE.md`、`SHARED.md`、`CREATIVE.md`、`ASSETS.md`、`AUDIO.md` |
| `operations/` | 怎么跑、怎么排错、怎么发布 | `WORKFLOW.md`、`WORKBENCH.md`、`FISSION.md`、`QUALITY.md`、`DEPENDENCIES.md`、`TROUBLESHOOTING.md` |
| `reference/` | 细则、提示词库与镜头卡 | `RULES.md`、`MOTION_PROMPTS.md`、`shots/` |
| `records/` | 当前有效的经验与决策索引（默认阅读面） | `LESSONS.md`、`DECISIONS.md` |
| `archive/` | 历史全文，**默认不读** | `STATUS-HISTORY.md`、`LESSONS-HISTORY.md`、`DECISIONS-ADRS.md` |

根目录文档：`README.md`（部署与总览）、`PLAN-NEXT.md`（当前计划，完成后删除）。

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
| `reference/shots/` | 镜头卡（创意参考，非运行时） | 增删卡片 |
| `records/LESSONS.md` | 仍然有效的经验规则（短清单） | 每次任务结束追加一条 |
| `records/DECISIONS.md` | ADR 索引与状态 | 新增决策时加一行 |
| `PLAN-NEXT.md` | 当前计划与验收标准 | 计划推进或完成时更新；完成后删除 |

## 新增与修改规则

1. **先查后写**：先看本索引与对应权威文档，能补进现有文件的，不新建文件。
2. **一个主题一个文件**：同一事实只在一处维护；其他文档用链接指向它，不复制内容。
3. **按类别放**：架构进 `architecture/`，操作进 `operations/`，规则与素材库进 `reference/`；除 `PLAN-NEXT.md` 外不要放在 `docs/` 根目录。
4. **不按会话建文档**：进展与验收写进 `PLAN-NEXT.md`，不新增 `NOTES-<date>.md`。
5. **记录分两层**：新坑先按“现象/原因/修法/预防”追加到 `archive/LESSONS-HISTORY.md`，再把一条可执行规则写进 `records/LESSONS.md`；新决策全文追加到 `archive/DECISIONS-ADRS.md`，`records/DECISIONS.md` 只加一行索引与状态。`records/` 保持小，`archive/` 只增不减。
6. **计划不长期堆积**：`PLAN-NEXT.md` 只保留当前计划；完成或被替代后删除，历史在 git 中查。
7. **链接用仓库相对路径**：`docs/architecture/SHARED.md`，不要用绝对路径或只在某个目录有效的相对路径。
8. **代码同步**：改模块/命令/配置时，同一次改动里更新对应文档；`npm run check` 会校验必读文档是否存在。
9. **不写空话**：文档只写约束、格式、命令、示例；不写“我们以后可能会……”式的设想。

## 默认阅读面

新会话只需要：本文件 → `reference/RULES.md` → 与任务相关的 `architecture/` 文档；当前计划看 `PLAN-NEXT.md`。
`records/LESSONS.md` 是短清单，可整读；`records/DECISIONS.md` 按需查阅；`archive/` 默认不读，追溯问题时搜索。
`docs/reference/shots` 与 `MOTION_PROMPTS.md` 是创意参考，按需取用，不默认通读。

Agent 与人类使用同一套命令与闸门；写区、标准循环、机器可读自检与 Done 定义见
[operations/WORKFLOW.md](operations/WORKFLOW.md) 第 12 节「Agent 协作」。

## 防止混乱的自检

提交前问自己：

- 这条信息是否已有权威位置？没有才新增。
- 新文档能否并进现有文件？能并就不新建。
- 是否把同一规则复制到了第二处？改成链接。
- 是否把一次性进展写进了架构文档？应该留在任务上下文或 `PLAN-NEXT.md`。
