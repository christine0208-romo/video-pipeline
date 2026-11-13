# video-pipeline

独立工作区：扫描实拍素材、生成动效素材、自动混剪成竖屏视频。

```bash
npm install
npm run doctor
node run.mjs all
```

## 需要什么

- Node.js >= 22
- ffmpeg / ffprobe（PATH 中可用，或在 `config/pipeline.json` 的 `tools` 指定）
- Chrome 或 Playwright headless shell（Remotion 渲染用；可用 `REMOTION_BROWSER` 指定）
- 实拍素材目录（默认读取仓库相对路径 `footage/`；也可在 `config/local.json` 指定本机绝对路径）

## 新机器部署（只拉核心框架）

仓库只提交核心框架；`data/`、`out/`、`public/`、`node_modules/`、`.cache/`、`release/`、`projects/`、`config/local.json` 都不入库。项目包按需单独部署。

```bash
git clone <repo> video-pipeline
cd video-pipeline
npm ci
npm run doctor
```

准备素材目录后，创建本机覆盖配置（不要改 `config/pipeline.json` 里的共享默认值）：

```bash
cp config/local.example.json config/local.json
# 编辑 config/local.json 的 footage.roots 指向本机素材目录
```

然后生成运行数据：

```bash
node run.mjs scan
node run.mjs generate
node run.mjs quality
node run.mjs mix --duration 15 --dry-run
```

`config/pipeline.json` 是唯一共享配置；`config/local.json` 只放本机路径/工具覆盖，已被 gitignore。旧 catalog/EDL 不在仓库里，新机器从 scan/generate 重建。

## 三个模块

**一、实拍扫描与标注**

- 多根目录递归扫描，按 `size + mtime` 增量识别新增/变更/缺失。
- ffprobe 元数据、文件名/目录关键词打标、ffmpeg 场景切分、3 帧缩略图 + 接触表。
- 人工标签放素材根目录 `tags.json`，键可用相对路径、文件名或素材 id，人工字段优先。
- `scan --check` 发现新/变更素材时退出码 2，可用于「获取素材前先扫一遍」。

**二、生成素材库**

| preset | 画面 |
|---|---|
| `platform-orbit` | 品牌图标环绕、聚拢、落位 |
| `social-constellation` | 图标星座、连线与脉冲 |
| `network-universe` | 点阵世界地图、跨区域连线与光门 |
| `icon-morph` | 图标之间遮罩擦除式转换 |
| `ui-mock` | 手机界面示意：短信、通话、账号、注册 |
| `kinetic-grid` | 透视网格与穿越光门 |
| `text-atom` | 文字动效原子：T01 / T03 / T06 / T08 |
| `transition-atom` | 转场原子：flash / wipe / glitch / light-leak |

- 实底 `H.264 MP4`；支持叠加的 preset 另出 `VP9 + yuva420p` 透明 `WebM`。
- 按 `preset + props` 哈希缓存；`--only` 只补指定 preset，不会冲掉其它目录条目。
- `src/generated/recipes.json` 定义 recipe；每个 recipe 展开 palette / seed / text 等变体。
- `particle-atom` 与 `camera-scene` 由 recipe 驱动：ParticleEngine（P01 / P04 / P05）与 CameraEngine（C01 / C02 / C06 / C09）。
- 新生成素材默认 `draft`；`generate --review --status draft` 查看，`--approve` / `--reject` 审核。
- 混剪只消费 `approved`；`--allow-draft` 可临时预览未审核素材。
- 产物：`out/assets/`、`data/catalog.json`、`out/stills/assets/`。

**三、混剪**

- 节拍 `hook → build → proof → turn → close`，比例在配置里改。
- 每条成片至少 1 个实拍镜头；`turn` 至少 1 个生成片段。
- 同素材通过不同源区间、裁切焦点、缩放、推拉/平移、速度、调色、颗粒/扫描线/暗角制造差异。
- 同一成片：来源区间不重叠、相邻不重复、视觉签名唯一。
- 跨成片：`data/edl/signatures.json` 记录签名与源区间，新成片继续避让。
- 渲染：关键帧 → 3 段分段（每段抽 3 帧）→ 全片。

**四、裂变作品（模块二 + 模块三）**

- `fission` 默认按作品编排，直接复用 shared 素材库；`--with-assets` 时才从 recipe pool 生成作品专属素材。
- 不同作品默认不复用生成素材；只有 `--share` 手动提升的素材进入 shared。
- 每个 work 还会从 `src/generated/variation.json` 抽调色板、文本版式/背景/光位/字体/文案、粒子分布/背景、镜头底图/post/grade、转场角度/强度、时长、节奏和实拍主题。
- 素材以缓存形式留在模块二素材库；同一 work 重跑直接复用，`--force` 才重渲。
- `mix --work <id>` 只使用 shared + 当前 work 素材；planner 优先 work-local。
- `generate --list-works` 查看；`generate --clean-work <id>` 默认 dry-run，`--force` 才删除。
- 详见 `docs/FISSION.md`。

**五、音频**

- 默认自动选 BGM（AERIS CC0），按叙事角色做能量曲线，并在 SFX 下 duck。
- SFX 来自 Kenney CC0，按转场、文字叠加、UI mock 和节拍落点。
- 关闭：`--no-music` / `--no-sfx`；指定：`--music auto|<id>|<path>`。
- 设计规则、来源与响度：`docs/AUDIO.md`。

## 常用命令

```bash
node run.mjs all
```

```bash
npm run workbench
```

- 工作台默认地址 `http://127.0.0.1:4317/`；素材、成片、质量浏览与任务队列见 `docs/WORKBENCH.md`。
- 自动打开浏览器：`npm run workbench:open`。

```bash
node run.mjs scan --check
```

```bash
node run.mjs generate --only platform-orbit --variants 1
```

```bash
node run.mjs generate --recipe text-char-rise,transition-glitch --variants 1 --force
```

```bash
node run.mjs generate --review --status draft
```

```bash
node run.mjs generate --approve all
```

```bash
node run.mjs quality
```

```bash
node run.mjs quality --report-only
```

```bash
node run.mjs quality --edl mix-20261119-1
```

```bash
node run.mjs mix --duration 15 --outputs 2 --seed 20261108
```

```bash
node run.mjs mix --duration 15 --seed 20261108 --shot-length 2.4
```

```bash
node run.mjs mix --duration 12 --music auto --no-sfx
```

```bash
node run.mjs fission --works 3 --seed 20261108 --duration 12
```

```bash
node run.mjs fission --works 1 --seed 20261108 --duration 12 --with-assets --per-layer 1,2,2
```

```bash
node run.mjs generate --list-works
```

```bash
node run.mjs generate --share all-work:work-20261108-1
```

```bash
node run.mjs generate --clean-work work-20261108-1
```

```bash
node run.mjs stills
```

```bash
node run.mjs check
```

| 参数 | 说明 |
|---|---|
| `--config <file>` | 配置文件，默认 `config/pipeline.json` |
| `--roots a,b` | 覆盖素材根目录 |
| `--limit N` | 只处理 N 个新素材（调试） |
| `--check` | 扫描后有新/变更素材则退出码 2 |
| `--only p1,p2` | 只生成指定 preset |
| `--recipe r1,r2` | 只生成指定 recipe（清空 preset 列表） |
| `--no-recipes` | 本次不生成 recipe |
| `--variants N` | 每个 preset / recipe 生成几组 |
| `--variants-recipe N` | 每个 recipe 生成几组 |
| `--generate-duration N` | 生成片段时长（秒，仅 preset） |
| `--duration N` | 成片时长（秒） |
| `--outputs N` | 成片条数 |
| `--seed N` | 随机种子 |
| `--force` | 全量重做 |
| `--dry-run` | 只规划不渲染 |
| `--stills-only` | 只出静帧 |
| `--check-only` | 只校验已有 EDL |
| `--review` | 列出素材状态与静帧路径 |
| `--approve id1,id2` | 批准资产；`all` 批准全部 draft |
| `--reject id1,id2` | 退役资产；`all` 退役全部 draft |
| `--status draft` | 配合 `--review` 过滤状态 |
| `--allow-draft` | 混剪时允许使用 draft 资产 |
| `--music auto\|id\|path` | 指定 BGM；`auto` 为自动选曲 |
| `--no-music` | 关闭 BGM |
| `--music-mood <mood>` | 自动选曲情绪：calm / cinematic / uplifting / energetic |
| `--music-energy <level>` | low / medium / high |
| `--music-volume N` | 音乐音量 0–1 |
| `--no-sfx` | 关闭 SFX |
| `--sfx` | 开启 SFX |
| `--bpm N` | 指定 BPM；为空时用选中曲目的 BPM |
| `--work <id>` | 混剪只使用 shared + 指定 work 的素材 |
| `--works N` | fission 生成几个作品 |
| `--with-assets` | fission 时为每个作品生成专属素材（默认只用 shared） |
| `--work-seed N` | fission 指定 work seed |
| `--per-layer s,o,t` | fission 每类生成数量 |
| `--share id1,id2` | 把 work 素材提升为 shared |
| `--share all-work:<id>` | 提升某个 work 的全部素材 |
| `--list-works` | 列出 work 素材与产出 |
| `--clean-work <id>` | 清理 work 素材；默认 dry-run，加 `--force` 删除 |

## 配置

| 键 | 说明 |
|---|---|
| `spec.width/height/fps` | 画布规格，默认 1080×1920 / 30fps |
| `tools.ffmpeg/ffprobe` | 外部二进制名或绝对路径 |
| `footage.roots` | 实拍根目录，可多个 |
| `footage.extensions/exclude` | 扫描范围 |
| `footage.sidecars` | 人工标签文件名，默认 `tags.json` |
| `footage.cropDetect` | 是否检测黑边并记录裁剪区域 |
| `footage.sceneSplit` | `enabled/threshold/minShot/pad` |
| `footage.thumbs` | `enabled/count/width` |
| `generate.presets` | 启用的 preset |
| `generate.recipes` | 启用的 recipe |
| `generate.variantsPerPreset` | 每个 preset 生成几组 |
| `generate.variantsPerRecipe` | 每个 recipe 生成几组 |
| `generate.duration` | preset 生成片段时长（秒） |
| `generate.formats` | `mp4` / `webm-alpha` |
| `mix.duration/outputs/seed` | 成片时长、条数、随机种子 |
| `mix.maxPerAsset/minGap` | 单素材次数上限、源区间最小间隔 |
| `mix.maxPerRecipe` | 单条成片中同一 recipe 的使用上限 |
| `mix.generatedRatio` | 生成片段占比倾向 |
| `mix.allowDraft` | 是否允许混剪使用 draft 素材 |
| `mix.bpm` | 指定 BPM；为空时用选中曲目的 BPM |
| `mix.music` | `null` / `"auto"` / 曲目 id / 文件路径 / 对象 |
| `mix.sfx` | `enabled / volume / maxPerOutput / minGap` |
| `mix.beats` | 节拍角色与比例 |
| `fission.works` | 一次裂变生成几个作品 |
| `fission.seed` | 作品 ID 的基础 seed |
| `fission.duration` | 作品时长；`null` 使用 `mix.duration` |
| `fission.generateAssets` | 是否生成作品专属素材；默认 `false` |
| `fission.assetsPerLayer` | 每个作品 scene / overlay / transition 数量 |
| `fission.recipePool` | `"all"` 或 recipe id 数组 |

## 目录

```text
config/       主配置
modules/      scan / generate / mix / fission / lib
src/          Remotion composition 与 6 个 preset
common/       上游资源快照（engine / components / vendor / assets / shots）
data/         素材库、目录、EDL、签名库（gitignore）
out/          生成素材、静帧、分段、成片（gitignore）
public/       渲染静态根，运行时自动建链接（gitignore）
docs/         规则、经验、流程、模块、依赖、决策、排错
tools/        doctor / check
```

## 文档

先读 [CLAUDE.md](CLAUDE.md)。其余：

- [docs/ONBOARDING.md](docs/ONBOARDING.md) — 10 分钟上手
- [docs/RULES.md](docs/RULES.md) — 规则细则
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — 常见任务流程
- [docs/LESSONS.md](docs/LESSONS.md) — 踩坑记录（只追加）
- [docs/MODULES.md](docs/MODULES.md) — 模块与 preset 注册表
- [docs/MOTION_PROMPTS.md](docs/MOTION_PROMPTS.md) — 9 类 90 条动效提示词库、竖屏适配与配方字段
- [docs/AUDIO.md](docs/AUDIO.md) — 音效/BGM 设计、来源与响度规则
- [docs/FISSION.md](docs/FISSION.md) — 作品级生成素材隔离、缓存、提升与清理
- [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) — 依赖政策与登记
- [docs/DECISIONS.md](docs/DECISIONS.md) — 架构决策
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 排错
- [STATUS.md](STATUS.md) — 当前状态与待办
- [CREDITS.md](CREDITS.md) — 素材来源与许可

## 素材与许可

品牌图标来自 Simple Icons（CC0 1.0），品牌标识归各平台所有，仅作类别示意。字体为 SIL OFL 1.1。世界点阵地图为 Public Domain。镜头卡来自 video-shotcraft（Apache 2.0）。完整来源与许可见 [CREDITS.md](CREDITS.md)。

## 运行产物与缓存边界

- `data/`：持久运行索引、library/catalog、EDL、质量报告、workbench 状态；不要手改。
- `out/`：正式生成资产、静帧、分段、成片和项目输出；不要手改。
- `public/`：Remotion 静态根，只应包含 junction/symlink 投影；复制工作区后运行 `node run.mjs public` 检查，确认后用 `--apply` 迁移空目录。
- `.cache/video-pipeline/`：临时缓存；`out/checks` / `out/downloads` 也由 cache 命令管理。
- `node run.mjs cache list` 查看受管缓存；`node run.mjs cache clean` 只 dry-run；显式 `--force` 才删除。
- `node run.mjs reindex` 按 `out/assets` 实际文件重建 catalog（默认 dry-run，`--apply` 写回）；保留旧的审批/退役/质量状态。
- `node run.mjs runtime list|clean` 管理检查、下载、public 备份残留；`runtime prune-edl` 清理引用缺失实拍/生成的失效 EDL 及其成片。
- 核心框架不打包 `node_modules/`、`data/`、`out/`、`public/` 和外部实拍；可选项目由 `config/components.json` 与项目 manifest 声明。

## 配置与参数

- 稳定项目策略唯一来源是 `config/pipeline.json`，契约是 `config/pipeline.schema.json`。
- `node tools/check-config.mjs` 检查 schema、preset/recipe、项目 manifest 和 beat 引用。
- 临时参数通过 CLI 或工作台任务表单传入，不回写项目策略。
- 工作台配置接口：`/api/config`、`/api/parameters`、`/api/components`。
