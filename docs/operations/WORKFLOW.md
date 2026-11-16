# WORKFLOW

## 0. 10 分钟上手

新会话或新同事，按这个顺序走一遍。

1. **环境**：`npm run doctor`，看到“体检通过”再继续。
2. **配置**：看 `config/pipeline.json` 的 `footage.roots`、`spec`、`shared`、`creative`、`mix`；`node run.mjs shared status` 确认公共资源层。
3. **扫描**：`node run.mjs scan`；检查 `data/library.json` 的 `id / crop / scenes / thumbs`，看 `data/thumbs/*-sheet.jpg` 确认画面。
4. **构建一类创意素材**：`node run.mjs creative scan` → `node run.mjs creative build --creative <id>`；看 `out/stills/assets/` 确认构图与透明边缘。
5. **规划一条成片**：`node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run`；看 `data/edl/mix-*.json` 的 `beats/shots/stills`，再跑 `node run.mjs check`。
6. **实渲一条**：去掉 `--dry-run`；看 `out/stills/`、`out/segments/` 与 `out/mix-*.mp4`。

三件事：

1. **实拍是事实，生成是示意**；示意画面标「示意」。
2. **动画只来自帧**；不要用真实时间或 `Math.random`。
3. **改配置或源码，再重跑 stage**；不要手改 `data/`。

## 1. 新会话开工

```bash
npm run doctor
node run.mjs scan
```

- 读 `docs/README.md`、`docs/records/LESSONS.md`、`docs/reference/RULES.md` 与任务相关的架构文档。
- 看 `config/pipeline.json` 的 roots 与 spec。
- 看 `data/library.json` 的条数与 `data/catalog.json` 的条数。

## 2. 新增/更换实拍素材

1. 把素材放进任意一个 `footage.roots`；可加多个 root。
2. `node run.mjs scan`。
3. 看 `data/thumbs/*-sheet.jpg` 与 `data/library.json`。
4. 新增素材默认会进 `library.json`；缺失素材标 `missing`，不会删除旧记录。

## 3. 新增/更换素材库素材

1. 把文件放进任意一个素材根（默认 `assets/`，或 `config/pipeline.json` / `config/local.json` 的 `assets.roots`）。
2. `node tools/assets.mjs scan --apply` 登记；补 `license` 后跑 `node tools/assets.mjs check --strict`。
3. `node run.mjs scan` 重建 `public/assets` 合并树。

## 4. 新增生成引擎

1. 默认在创意工程的 `engine/` 新建 `index.tsx`（导出 `Component`）与 `engine.json`（参数 schema）；只有被第二个创意复用时才移到 `creative/engines/<engine>/`。
2. `creative.json` 写 `engine: "./engine"`（本地）或 `engine: "<engine>"`（共享）。
3. 运行 `node run.mjs creative scan --write-registry` 生成注册表。
4. 新建或更新一个创意工程引用该引擎。
5. `node run.mjs creative validate --strict`、`creative plan --creative <id>`。
6. 看 `out/stills/assets/` 静帧；需要透明叠加时检查 WebM alpha。
7. 更新 `docs/architecture/ARCHITECTURE.md`、`docs/architecture/CREATIVE.md` 等受影响文档，并把可执行经验写进 `docs/records/LESSONS.md`。

命名：引擎与创意 id 用 kebab-case，不用中文；画面上不出现内部标签。

## 4.1 新增或修改创意

1. 在 `creative/<id>/creative.json` 写意图、引擎、适用实拍条件与默认参数。
2. 在 `variants/*.json` 用 `style` + `items` 描述 1-n 条素材；文案、调色板、故障序号等按条覆盖。
3. `node run.mjs creative validate --strict`。
4. `node run.mjs creative plan --creative <id>` 看参数解析。
5. `node run.mjs creative build --creative <id> --dry-run`，再实际构建。
6. 工作台 `#/creative` 里预览、改参数、重新构建。
7. 更新 `docs/architecture/CREATIVE.md` 的工程清单。

## 4.2 审核与退役

```bash
node run.mjs creative review --creative <id> --status approved
node run.mjs creative review --id <assetId> --status retired
```

- `draft` 不会进入混剪；`approved` 才会。
- `retired` 保留文件，不参与混剪；需要重新启用时再 approve。
- 按变体批量审核会跳过已退役素材；单条 `--id` 可显式恢复。
- 临时预览未审核素材：`node run.mjs mix --allow-draft ...`。

## 4.3 音效与 BGM

- 音效索引：`shared/audio/sfx.index.json`；BGM 索引：`shared/audio/music.index.json`（音频文件在素材根 `assets/{sfx,music}`）。
- 默认 `mix.music` 为 `auto`，`mix.sfx.enabled` 为 `true`。
- 关闭：`--no-music` / `--no-sfx`；指定：`--music auto|<id>|<path>`。
- 新增、替换、归一化和选曲规则见 `docs/architecture/AUDIO.md`。

## 4.4 裂变作品

```bash
# 默认：用 shared 素材库编排，不生成新素材
node run.mjs fission --works 3 --seed 20261108 --duration 12

# 需要作品专属素材时才生成
node run.mjs fission --work t1 --duration 6 --with-assets --per-layer 1,1,1

node run.mjs mix --work work-t1 --duration 6
node run.mjs creative list-works
node run.mjs creative share <id,...>
node run.mjs creative clean-work work-t1
```

- 默认 `fission.generateAssets = false`：只用 shared + 实拍库；`--per-layer` 在默认模式下会被忽略。
- `--with-assets` 才按 work seed 从创意变体池选材，素材 `scope=work`，自动 `approved`。
- `mix --work` 不再强制专属素材；需要时加 `--require-work-asset`。
- 不同 work 专属素材相互隔离；`--share` 才进入 shared。
- `creative clean-work` 默认 dry-run，`--force` 才删除。
- 生成素材分类/完整性规则见 `docs/architecture/ASSETS.md`。
- 详见 `docs/operations/FISSION.md`。

## 4.5 质量与覆盖

```bash
node run.mjs quality
node run.mjs quality --force
node run.mjs quality --report-only
node run.mjs quality --edl mix-20261119-1
node run.mjs quality --strict
```

- `creative build` / `fission` 渲染后自动分析；`quality` 可单独重算或复查。
- 报告：`data/quality/report.json`、`out/quality/report.md`。
- 近似重复先判断是否共用底图（camera 系素材与其 base preset 会聚在一起），不是所有近邻都要改。
- `quality.ok = false` 的素材默认不进入混剪；`--allow-low-quality` 只做预览。
- 详见 `docs/operations/QUALITY.md`。

## 5. 新增混剪规则

改 `modules/mix/planner.mjs`：

- `FOCUSES` / `ZOOMS` / `MOTIONS` / `SPEEDS` / `GRADES` / `OVERLAYS`：视觉变体池。
- `focusFor()`：带 crop 素材的焦点策略。
- `planBeats()`：节拍比例。
- `decideKind` 逻辑在 `planOutput()` 内：决定实拍/生成片段。
- `pickFootageShot()`：源区间与素材选择。
- `pickGeneratedShot()` / `pickOverlay()`：生成片段与叠加。

任何新规则都要在 `modules/mix/uniqueness.mjs` 加校验，或者在 `docs/records/DECISIONS.md` 写清为什么不需要。

改完：

```bash
node run.mjs mix --duration 12 --outputs 2 --seed 20261108 --dry-run
node run.mjs mix --duration 12 --seed 20261108 --shot-length 2.4 --dry-run
node run.mjs check
```

- 镜头节奏：`mix.shotLength.min/max` 定目标镜头长度，`beatJitter` 给每作品抖动，`minShots/maxShots` 定数量范围。
- CLI：`--shot-length N`、`--shot-min N`、`--shot-max N`、`--beat-jitter N`、`--min-shots N`、`--max-shots N`。
- 节拍是叙事窗口，镜头可以跨节拍；看 EDL 时以 `shot.at/dur` 为准。

通过后再实渲。

## 6. 新增依赖

1. 先查 `docs/operations/DEPENDENCIES.md` 的候选表。
2. 安装并锁版本。
3. 做 3 帧双渲染逐字节一致测试（或说明为什么不需要）。
4. 在 `docs/dependencies.json` 的 `approved` 登记：版本、用途、许可、确定性结论。
5. 在 `docs/operations/DEPENDENCIES.md` 表格加一行。
6. `npm run check`。

## 7. 升级核心原语（common/engine）

`common/engine` 是核心工具（运动数学、时间、字体门、Canvas 桥），不是上游整包快照。升级时：

1. 备份当前 `common/engine`。
2. 替换或合并升级后的文件；`motion-core`、`time`、`fonts` 的来源与许可见 `common/engine/README.md`。
3. `npm run doctor`。
4. `npm run typecheck`。
5. `node run.mjs creative build --force`，看静帧。
6. `node run.mjs mix --duration 12 --outputs 1 --dry-run`。
7. 更新 `shared/CREDITS.md`（如有新素材）或 `docs/operations/DEPENDENCIES.md`（如有新依赖）。

## 8. 重置运行数据

推荐用受管命令清空生成产物（默认 dry-run）：

```bash
node run.mjs creative reset
node run.mjs creative reset --apply --force
```

它只删除 catalog 生成条目、props、`out/assets`、静帧、`out/creatives`、质量报告、EDL 与 works 配置；实拍索引、TTS 和成片文件保留。

彻底重建运行目录：

```bash
rm -rf data out public
```

然后：

```bash
node run.mjs scan
node run.mjs creative build
node run.mjs mix
```

只重置去重记录：

```bash
rm data/edl/signatures.json
```

## 8.1 运行目录与安全迁移

复制仓库后先检查静态投影，不要直接删除 `public/`：

```bash
node run.mjs public
node run.mjs public --apply
```

`--apply` 只会隔离空实体目录；非空冲突需要人工确认和 `--force`。缓存/检查产物使用：

```bash
node run.mjs cache list
node run.mjs cache clean
node run.mjs cache clean --force
```

核心框架、项目 manifest 和外部输入的边界见 `config/components.json` 与 `projects/*/project.json`（用 `node run.mjs projects scan` 发现和校验）。`data/`、`out/`、`public/` 都是运行区域，不应作为核心源码包提交。

## 9. 渲染与复查

```bash
node run.mjs creative scan
node run.mjs creative build --creative icon-neon --force
node run.mjs creative preview --creative text-display --variant char-rise
node run.mjs creative review --creative text-display --status approved
node run.mjs quality --report-only
node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run
node run.mjs mix --duration 12 --outputs 1 --seed 20261108
node run.mjs mix --duration 12 --music auto --no-sfx
```

- 静帧：`out/stills/`。
- 分段：`out/segments/`。
- 成片：`out/mix-*.mp4`。
- 透明素材：`out/assets/*.webm`。
- 音频：看 `data/edl/mix-*.json` 的 `audio.music` 与 `audio.sfx`；成片 `ffprobe` 应有音频流。

## 10. 提交前

```bash
npm run check
npm run typecheck
node run.mjs check
```

- 更新相关文档；计划进度写进 `docs/PLAN-NEXT.md`。
- 新坑按记录规则归档：详情进 `docs/archive/LESSONS-HISTORY.md`，可执行规则进 `docs/records/LESSONS.md`。
- 新组件更新 `docs/architecture/ARCHITECTURE.md`。
- 新素材更新 `shared/CREDITS.md`（由 `shared credits` 生成）。
- 不提交 `data/`、`out/`、`public/`、`node_modules/`。

## 11. 调试一条 EDL

- 看 `data/edl/mix-*.json` 的 `beats[].shots[]`：
  - `kind`：`footage` / `generated`；
  - `assetId`、`src`、`in`、`dur`、`speed`；
  - `transform.focus/zoom/motion/grade`；
  - `overlay`：透明叠加；
  - `signature`：去重签名。
- 看 `out/stills/<id>/frame-*.png` 的构图。
- 看 `out/segments/<id>/seg-*/still-*.png` 的分段检查帧。
- 对比两条 EDL 的 `signature` 与 `(assetId, in, dur)`，确认没有重复。

## 12. Agent 协作

Agent 与人类使用同一套命令与闸门；不允许自创目录、配置键或替代流程。

### 12.1 写区与禁区

| 可以写 | 不可以写 |
|---|---|
| `creative/`（工程、引擎、变体、工程自带 `assets/`） | `modules/`、`src/`、`tools/`、`workbench/`（除非任务本身就是改框架） |
| `shared/`（清单、字体、音频索引、预设、公共代码） | `config/pipeline.json`（共享默认值；本机差异写 `config/local.json`） |
| `assets/`（素材文件） | `data/`、`out/`、`public/`（运行产物，只由命令写） |
| `projects/`、`config/local.json` | 仓库根目录新增散落文件 |

禁止事项：

- 不得发明新目录、新配置键、新命令或平行流程；
- 不得在未说明职责、替代方案与优缺点前新增核心文件；能用现有文件、配置或依赖解决的不新建；
- 不得把创意实现、素材清单、平台预设写进 core；
- 不得手改 `data/`；需要改就改配置或源码并重跑 stage；
- 不得推断许可；未知许可的素材不登记、不使用；
- 不得跳过 `validate` / `preview` 直接 `build` 或 `mix`；
- 不并发跑多个 Remotion 渲染。

### 12.2 标准循环

新增核心文件前，先按 `docs/reference/RULES.md` 第 11 节给出“四问”提案；用户确认或满足独立消费者、独立依赖方向、稳定职责后再建文件。

资源准备（首次或换内容包时）：

```bash
node run.mjs shared init          # 生成结构与素材目录
node tools/assets.mjs add <文件|目录|URL> --license <许可> --source <来源>
node run.mjs shared credits --write --force
node run.mjs shared validate --strict --json
```

创意与出片：

```bash
node run.mjs creative new <id> --name <名称>
# 写 creative/<id>/README.md：意图、节拍、时长、素材依赖、验收标准
node run.mjs creative validate --strict --json
node run.mjs creative preview --creative <id> --variant <variant>
# 看 out/creatives/ 静帧，迭代 engine.json / index.tsx / variants
node run.mjs creative build --creative <id>
node run.mjs quality --report-only
node run.mjs creative review --creative <id> --status approved
node run.mjs sync --check
npm run check
```

素材：实拍放 `footage.roots` 后 `scan`；公共素材放 `assets/` 后 `sync --apply`；工程专属素材放 `creative/<id>/assets/`，参数写 `project/...`。

### 12.3 机器可读自检

Agent 应读结构化输出，不要解析人类文本：

```bash
node run.mjs creative validate --strict --json   # { ok, engines, projects, errors, warnings }
node run.mjs shared status --json                # 清单/字体/音频/预设/素材根
node run.mjs shared validate --strict --json     # { ok, errors, warnings }
node run.mjs creative plan --json                # 将生成的素材
node run.mjs quality --report-only               # data/quality/report.json
ALLOW_NEW_FILES=1 npm run check                  # 仅在新文件四问已确认时使用
```

### 12.4 完成定义（Done）

- `creative validate --strict --json` 的 `ok=true`；
- `preview` 至少 3 个静帧检查通过（构图、文字可读、透明边缘）；
- `build` 失败 0，`quality` 无 `ok=false`；
- 变体已 `approved`；
- `npm run check`、`npm run typecheck`、`shared validate --strict` 通过；
- 相关文档更新；新坑按记录规则归档。

### 12.5 结果一致性

- 同一类任务只使用本节的命令链；不要用临时脚本替代；
- 交付报告必须列出实际执行的命令与关键结果（数量、时长、失败数、质量标记）；
- 发现系统缺少能力时，先记录并新建任务，不要在本任务里临时扩架构。

## 13. 分支与版本

默认约定：**功能升级推进期间保持 `0.0.x`（小步迭代）；只有用户明确宣布“稳定点”时才用 `0.y.0`；正式发行版才用 `1.0.0`。禁止擅自升版本。**

### 13.1 版本语义

| 类型 | 触发 | 版本 |
|---|---|---|
| 开发迭代 | 功能、文档、修复等日常小步改动（默认） | `0.0.N` |
| 阶段稳定点 | 用户明确宣布稳定点、功能升级告一段落 | `0.Y.0` |
| 稳定点修复 | 稳定点上的 bug 与文档修复 | `0.Y.Z` |
| 正式发行版 | 用户明确宣布结束开发阶段 | `1.0.0` |
| 正式版之后 | 已发行版本的不兼容变更 | `X.0.0`（X≥2） |

- 功能升级未结束时不要升 `0.1.0`；每次迭代只把 `0.0.N` 的 N +1。
- 当前开发线为 `0.0.2`；是否进入 `0.1.0` 由用户决定。
- 版本号写在 `package.json`；用 `npm version <ver> --no-git-tag-version` 同步 `package-lock.json`。
- 发布后打附注标签 `vX.Y.Z`。

### 13.2 分支

| 分支 | 用途 | 生命周期 |
|---|---|---|
| `main` | 始终可发布；只接收通过门禁的合并 | 长期 |
| `feat/<slug>` | 小版本功能（默认） | 合并后删除 |
| `fix/<slug>` | 补丁 | 合并后删除 |
| `release/<slug>` | 稳定版或用户明确宣布的大版本，可含多个提交 | 发布后删除 |
| `exp/<slug>` | 试验，不合并 | 按需 |

- 一个分支只做一个版本；不要在同一分支混入下一个小版本。
- 不在 `main` 上直接开发。当前这次大改动是例外：已作为 `v0.0.2` 直接进入 `main`。
- 合并前跑完整门禁；合并后在 `main` 上打 tag 并推送。

### 13.3 发布流程

```bash
git switch -c feat/<slug>
# 开发，更新 PLAN-NEXT 与相关文档
npm version patch --no-git-tag-version    # 开发迭代用 patch；只有用户宣布稳定点才用 minor；正式发行用 1.0.0
npm run check && npm run typecheck
node run.mjs shared validate --strict --json
node run.mjs creative registry --check
git add -A && git commit
git switch main
git merge --squash feat/<slug> && git commit
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main && git push origin vX.Y.Z
```

- 远程只有 `origin`；旧的 `old-origin` 已移除。
- 不推送未通过门禁的提交；`data/`、`out/`、`public/` 与内容区不进入版本库。
