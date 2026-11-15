# STATUS

- 日期：2026-11-15
- 规格：1080×1920 / 30fps（`config/pipeline.json` 的 `spec`）
- 架构：`core / shared / creative / assets` 四层，见 [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- 公共资源：`shared/` 清单 82 条、字体 8、音效 13、BGM 5、镜头卡 121；素材根 `assets/` 82 个文件
- 创意工程：11 个工程 / 55 条素材（全部来自 `creative/`）
- 实拍：26 条（素材根见 `config/local.json`）
- 混剪默认：30 秒 / 1 条 / 自动 BGM / SFX 开启 / 质量闸门 + 同片感知去重 / 镜头长度 1.4–2.6 秒 + 节拍抖动 15%

> 历史会话与验收记录（2026-11-08 ～ 2026-11-15）在 [docs/archive/STATUS-HISTORY.md](docs/archive/STATUS-HISTORY.md)。

## 最近验证（2026-11-15）

- `typecheck`、`check`、`doctor`（0 警告）、`sync --check`、`node run.mjs check` 通过。
- `shared status`：清单 82 / 字体 0 缺失 / sfx 13 / music 5 / 镜头卡 121 / 素材根 82 文件；`shared validate` 0 错 0 警告。
- 部署等价副本：空核心 `shared init` → `validate` → `check` 通过；放入素材后 `sync --apply` 登记，`--strict` 在补许可前失败、补后通过。
- `mix --dry-run`：EDL 无 `transitionIn`，5/6 镜头带 `transitionAsset`，BGM 1 首 + SFX 15 个；`mix --stills-only` 渲染正常。
- 工程自带素材：`project/...` 解析到 `creative/<id>/assets/...`，`public/creative/<id>/assets` 挂载生效。
- 文档重组：`docs/` 分为 `architecture/`、`operations/`、`reference/`、`records/`、`archive/`，新增 `docs/README.md` 治理规则；ONBOARDING 并入 WORKFLOW；STATUS 历史归档；所有引用与 check 必读列表已更新，markdown 链接检查通过（内容包镜头卡有 5 个缺失的 data 卡片链接，见已知限制）。
- 控制默认阅读面：`records/LESSONS.md` 从 463 行压缩为 55 行规则清单，`records/DECISIONS.md` 从 361 行压缩为 32 行 ADR 索引；全文分别归档到 `archive/LESSONS-HISTORY.md`、`archive/DECISIONS-ADRS.md`；删除已完成的 `PLAN-CORE-CLEAN.md`；`archive/` 默认不读，仅追溯时搜索。
- Agent 协作规范：`operations/WORKFLOW.md` 第 12 节写入写区/禁区、标准循环、机器可读自检与 Done 定义；`CLAUDE.md` 增加第 7 条硬规则“Agent 只在内容区工作”；`docs/operations/WORKFLOW.md#12-agent-协作` 为唯一流程来源。
- 机器可读输出：`creative validate --json`、`shared status --json`、`shared validate --json`；`run.mjs` 的阶段进度改走 stderr，保证 stdout 只有 JSON。
- 镜头卡：`shared/shots/README.md` 明确“非运行时、按 INDEX 检索、只读需要的卡片”；`INDEX.md` 中 5 张未随包提供的卡片已标注，不再产生断链。

## 待办

- `shared` / 清单 / 音频索引的 `version` 迁移机制（当前为 1；结构变化时需要 `shared migrate`）。
- 品牌基线：保留一套必须一致的字体/留白/色调规则，避免变化轴过多稀释识别度。
- 工作台第二阶段：批量任务表、发布打包、同步状态可视化。
- 素材 `kind` 规则表（目前按一级目录推断）。
- 外部素材根跨盘时硬链接退化为复制，需要重跑 scan/sync。

## 已知限制

- 转场只来自内容素材（透明 WebM `shot.transitionAsset`）；没有转场素材时是硬切。
- 音效按类别选第一条，不再按具体素材定制落点。
- 画面后期只有 `grade`（亮度/对比/饱和）；grain / scanline / vignette 已移除。
- `common/` 只有 `common/engine`，其中 `motion-core`、`time`、`fonts` 源自 fy-code-animation；升级直接改该目录。
- `shared/`、`creative/`、`assets/` 是本地内容，不入库；结构与规范随核心分发（`docs/architecture/SHARED.md`）。
- 设计令牌（含 TikTok 避让）在 `shared/presets/design.ts`，核心不含任何项目数值。
- EDL 的 `beats[]` 是叙事窗口，`beats[].shots[]` 可能为空，镜头可跨节拍；排查以 `shot.at/dur` 为准。
- 目标镜头长度是近似值；节拍边界、最短镜头约束、转场与 `maxLen × 1.8` 的拆分会拉动实际时长。
- `quality` 的 pHash 对纯色极简画面区分度有限，仍需人工抽帧复查；分析每段多 1–2 次 ffmpeg 抽帧。
- BGM 自动选曲是规则评分，不是人工试听。
- Work 素材需要 MP4 + 可选 WebM + 2 静帧；fission 串行渲染，耗时不短。
- `--clean-work` 只删素材，不删成片与 EDL；跨作品复用只能 `--share` 手动提升。
- 工作台只监听 `127.0.0.1`，无登录/权限；一次只跑一个任务；尚无发布/上传。
- 镜头卡是参考资料，不参与运行时；镜头卡参数按横屏标定；`shared/shots/INDEX.md` 引用的 5 个 `data/*.md` 卡片不在当前内容包里。

## 下一会话

- 先 `git status`，未提交改造不要回退。
- 新机器：`npm ci` → `node run.mjs shared init` → 放入 `creative/`、`shared/`、`assets/`（或 `assets:fetch`）→ `node run.mjs sync --apply` → `creative build`。
- 文档改动遵守 [docs/README.md](docs/README.md) 的分类与合并规则。
