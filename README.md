# video-pipeline

把**实拍素材**扫描成可检索的镜头库，用**创意工程**生成可叠加的动效素材，再自动混剪成「同素材而画面不重复」的竖屏视频。

- **实拍库**：多目录扫描、场景切分、裁切检测、缩略图；混剪时按源区间去重。
- **创意工程**：一个工程 = 意图 + 参数 + 若干变体；每个 item 编译成一条素材（MP4 + 透明 WebM），可批量生成、审核、裂变。
- **混剪 / 裂变**：按节拍规划镜头，自动配 BGM 与音效，跨成片做签名去重；裂变可按作品隔离素材。

核心仓库只包含**机制与脚手架**；实拍、素材、创意工程、成片项目都是本地内容，按需放入。

---

## 1. 需要什么

| 依赖 | 要求 | 检查 |
|---|---|---|
| Node.js | ≥ 22 | `node -v` |
| ffmpeg / ffprobe | 支持 `libvpx-vp9`（透明 WebM 分析） | `npm run doctor` |
| 浏览器 | Chrome 或 Playwright headless shell（Remotion 渲染） | `npm run doctor` |
| 磁盘 | 素材与渲染产物按项目大小预留 | — |

```bash
npm run doctor   # 一次检查 Node、依赖、ffmpeg、浏览器、素材根；有问题按提示修
```

---

## 2. 第一次运行（约 10 分钟）

```bash
git clone <repo> video-pipeline
cd video-pipeline
npm ci                        # 安装依赖；postinstall 生成空的 creative/registry.ts
node run.mjs shared init      # 生成 shared/ 结构（清单、字体、音频索引、预设、公共代码目录）
npm run doctor                # 体检；此时会提示素材未部署，属正常
```

接下来按需要补齐三类内容：

**① 实拍素材**（必需，否则无法出片）

```bash
# 把视频放进 footage/ 目录，或在本机配置里指定绝对路径：
#   config/local.json -> { "footage": { "roots": ["D:/my-footage"] } }
node run.mjs scan             # 扫描成 data/library.json；看缩略图确认画面
```

**② 公共素材**（字体/图标/音乐/音效；渲染文字和图标时需要）

```bash
node tools/assets.mjs add <文件或目录或 URL> [更多目标...] [--keep] --license <许可> --source <来源>
# 例：
#   node tools/assets.mjs add ~/fonts/Inter-Regular.woff2 --kind fonts --family Inter --weight 400 --license OFL-1.1
#   node tools/assets.mjs add https://cdn.simpleicons.org/whatsapp/ffffff --kind icons --name whatsapp.svg --license CC0-1.0 --source "Simple Icons"
#   node tools/assets.mjs add ~/my-assets --license CC0-1.0          # 目录按一级目录推断 kind
#   node tools/assets.mjs add --keep ~/my-pack --license CC0-1.0    # 保留原目录结构，不归类
#   node tools/assets.mjs add a.png b.svg ~/icons                   # 多个目标一次导入
node run.mjs shared credits --write --force   # 从清单生成 shared/CREDITS.md
node run.mjs shared validate --strict         # 检查缺失、引用、清单一致性
```

`assets add` 会自动复制文件、计算哈希、写清单、编入音频索引，并从清单生成 `shared/fonts.ts`——**不需要手写任何列表**。字体 family 推断不准时用 `node tools/assets.mjs font set <path> --family ...` 修正。已有清单时也可以用 `npm run assets:fetch` 按清单部署。

**③ 创意工程**（生成素材的来源）

```bash
node run.mjs creative new my-effect --name 我的动效   # 生成最小可运行工程
node run.mjs creative preview --creative my-effect --variant main   # 出静帧
node run.mjs creative build --creative my-effect                    # 渲染素材 + 质量分析
```

**第一次出片**

```bash
node run.mjs mix --duration 12 --outputs 1 --seed 20261108 --dry-run   # 先看 EDL
node run.mjs mix --duration 12 --outputs 1 --seed 20261108             # 实渲到 out/
```

---

## 3. 完全手动怎么用（不依赖 AI）

所有步骤都有命令和脚手架；清单、哈希、注册表由系统生成，你只需要放文件、改参数、做审核。

1. **准备实拍**：放进素材根 → `node run.mjs scan`。
2. **准备公共素材**：`node tools/assets.mjs add ...` → `shared credits` → `shared validate --strict`。
3. **建创意工程**：`node run.mjs creative new <id>`（或复制一个现成工程目录到 `creative/`）。
4. **改创意**：编辑 `creative/<id>/engine/engine.json`（参数）、`engine/index.tsx`（动效）、`variants/*.json`（变体与 items）。
5. **自检**：`node run.mjs creative validate --strict`。
6. **看画面**：`node run.mjs creative preview --creative <id> --variant <v>`，看 `out/creatives/` 静帧。
7. **构建**：`node run.mjs creative build --creative <id>`，看 `out/assets/` 与 `out/stills/assets/`。
8. **审核**：`node run.mjs creative review --creative <id> --status approved`（未批准不会进混剪）。
9. **混剪**：先 `mix --dry-run` 看 EDL，再实渲。
10. **裂变**（可选）：`node run.mjs fission --works 1 --duration 6 --dry-run`，确认后去掉 `--dry-run`。
11. **收尾**：`npm run check`、`npm run typecheck`、`node run.mjs check`。

> 需要图形界面时运行 `npm run workbench`，打开 `http://127.0.0.1:4317/`：素材、创意、任务、成片、质量五个页面，任务队列带实时日志。

---

## 4. 三个模块

| 模块 | 命令 | 做什么 |
|---|---|---|
| 扫描 | `node run.mjs scan` | 实拍入库：元数据、场景、缩略图；产出 `data/library.json` |
| 创意 | `node run.mjs creative ...` | 编译工程 → 渲染素材 → 质量分析 → 审核；产出 `out/assets` 与 `data/catalog.json` |
| 混剪 | `node run.mjs mix` | 规划 EDL、去重、渲染；产出 `data/edl/*.json` 与 `out/mix-*.mp4` |
| 裂变 | `node run.mjs fission` | 按作品隔离生成素材并出片；素材可 `--share` 提升为共享 |

---

## 5. 常用命令（按场景）

```bash
# 环境与状态
npm run doctor                     # 体检：依赖 / ffmpeg / 浏览器 / 素材根
node run.mjs shared status         # 公共资源：清单、字体、音频、预设、素材根
node run.mjs shared status --json  # 同上，机器可读

# 公共资源
node tools/assets.mjs init         # 只建 assets/{fonts,icons,music,sfx,brand,map}
node tools/assets.mjs add <源> [更多源...] [--keep] --license L   # 导入并登记；字体/音频索引自动维护
node tools/assets.mjs font list             # 查看字体条目与 family/weight
node tools/assets.mjs font set <path> --family X --weight N   # 修正字体元数据并重写 fonts.ts
node tools/assets.mjs audio scan --apply     # 扫描所有素材根，登记未编入索引的音频
node tools/assets.mjs audio set <id> --category tap --gain 0.4   # 调整音效类别/增益
node tools/assets.mjs audio list             # 查看音乐/音效索引
node run.mjs shared fonts --write           # 从清单生成 shared/fonts.ts
node tools/assets.mjs scan --apply # 把已放入 assets/ 的文件登记进清单
npm run assets:fetch -- --from <dir>         # 按清单从本地目录部署
node run.mjs shared credits --write --force  # 生成 shared/CREDITS.md
node run.mjs shared validate --strict        # 许可与引用完整性

# 实拍
node run.mjs scan --check          # 有新增/变更时退出码非 0（CI 用）
node run.mjs scan --limit 3        # 只处理 3 个新文件（调试）

# 创意
node run.mjs creative new <id> --name <名称>  # 脚手架
node run.mjs creative validate --strict       # 校验工程/引擎/变体
node run.mjs creative plan --creative <id>    # 只看将生成什么，不写文件
node run.mjs creative preview --creative <id> --variant <v>  # 静帧
node run.mjs creative build --creative <id>   # 渲染 + 质量分析
node run.mjs creative review --creative <id> --status approved
node run.mjs creative scan --write-registry   # 新增/移动引擎后重写注册表
node run.mjs creative registry [--check]      # 只重写/检查 engine 注册表

# 混剪与质量
node run.mjs mix --duration 15 --outputs 2 --dry-run   # 先看 EDL
node run.mjs mix --duration 15 --outputs 2             # 实渲
node run.mjs mix --stills-only                          # 只出关键帧
node run.mjs quality --report-only                      # 质量与覆盖报告
node run.mjs quality --strict                           # 有失败/近似重复时退出 1
node run.mjs fission --works 2 --duration 6 --dry-run   # 裂变预演
npm run workbench                                       # 本地工作台

# 收尾
node run.mjs sync --check          # 注册表 + 素材清单是否最新
npm run check                      # 工作区体检
npm run typecheck                  # TypeScript
node run.mjs check                 # 已有 EDL 的去重/时长校验
```

---

## 6. 配置

| 文件 | 放什么 | 入库 |
|---|---|---|
| `config/pipeline.json` | 可移植默认值：`spec`、`footage.roots`、`assets.roots`、`shared.root`、`creative.root`、`mix` | 是 |
| `config/local.json` | 本机覆盖：素材绝对路径、ffmpeg 路径 | 否 |
| `config/parameters.json` | 工作台任务表单的字段 | 是 |

不要为了本机路径改 `pipeline.json`；写进 `config/local.json`（参考 `local.example.json`）。

---

## 7. 目录

```text
run.mjs        一键入口：scan / creative / quality / mix / fission / sync / shared ...
modules/       scan / creative / quality / mix / fission / lib
src/           Remotion composition 与通用类型
common/engine  核心原语（运动数学、时间、字体门、Canvas 桥）
config/        主配置与本机覆盖
tools/         doctor / check / assets / shared / sync / projects / reindex / cache
workbench/     本地 Web 工作台
docs/          分类文档（入口：docs/README.md）
docs/PLAN-NEXT.md  当前计划（完成后删除）
shared/        公共资源层：清单、字体/音频索引、预设、公共代码（本地，gitignore）
creative/      创意工程包：每个工程独立的引擎、变体、可选本地素材（本地，gitignore）
assets/        素材文件库：fonts / icons / music / sfx / brand / map（本地，gitignore）
projects/      成片项目（本地，gitignore）
data/ out/ public/  运行产物（本地，gitignore）
```

---

## 8. 文档

文档索引与阅读顺序见 [docs/README.md](docs/README.md)。最常用的：

- [docs/operations/WORKFLOW.md](docs/operations/WORKFLOW.md) — 上手与常见任务，含 Agent 协作规范
- [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) — 分层与模块地图
- [docs/architecture/SHARED.md](docs/architecture/SHARED.md) — 公共资源层与素材库（谁负责什么、冲突怎么处理）
- [docs/architecture/CREATIVE.md](docs/architecture/CREATIVE.md) — 创意工程格式与引擎契约
- [docs/reference/RULES.md](docs/reference/RULES.md) — 规则细则
- [docs/operations/TROUBLESHOOTING.md](docs/operations/TROUBLESHOOTING.md) — 排错

---

## 9. 许可

核心代码与依赖许可见 [docs/operations/DEPENDENCIES.md](docs/operations/DEPENDENCIES.md)；公共素材的许可记录在 `shared/CREDITS.md`（生成物，由 `shared credits` 从清单生成）。
