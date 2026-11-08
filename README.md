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
- 实拍素材目录（默认 `D:/Files/AI_Vedio/1_素材库/vedio`，在配置里改）

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

- 实底 `H.264 MP4`；支持叠加的 preset 另出 `VP9 + yuva420p` 透明 `WebM`。
- 按 `preset + props` 哈希缓存；`--only` 只补指定 preset，不会冲掉其它目录条目。
- 产物：`out/assets/`、`data/catalog.json`、`out/stills/assets/`。

**三、混剪**

- 节拍 `hook → build → proof → turn → close`，比例在配置里改。
- 每条成片至少 1 个实拍镜头；`turn` 至少 1 个生成片段。
- 同素材通过不同源区间、裁切焦点、缩放、推拉/平移、速度、调色、颗粒/扫描线/暗角制造差异。
- 同一成片：来源区间不重叠、相邻不重复、视觉签名唯一。
- 跨成片：`data/edl/signatures.json` 记录签名与源区间，新成片继续避让。
- 渲染：关键帧 → 3 段分段（每段抽 3 帧）→ 全片。

## 常用命令

```bash
node run.mjs all
```

```bash
node run.mjs scan --check
```

```bash
node run.mjs generate --only platform-orbit --variants 1
```

```bash
node run.mjs mix --duration 15 --outputs 2 --seed 20261108
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
| `--variants N` | 每个 preset 生成几组变体 |
| `--generate-duration N` | 生成片段时长（秒） |
| `--duration N` | 成片时长（秒） |
| `--outputs N` | 成片条数 |
| `--seed N` | 随机种子 |
| `--force` | 全量重做 |
| `--dry-run` | 只规划不渲染 |
| `--stills-only` | 只出静帧 |
| `--check-only` | 只校验已有 EDL |

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
| `generate.variantsPerPreset` | 每类生成几组 |
| `generate.duration` | 生成片段时长（秒） |
| `generate.formats` | `mp4` / `webm-alpha` |
| `mix.duration/outputs/seed` | 成片时长、条数、随机种子 |
| `mix.maxPerAsset/minGap` | 单素材次数上限、源区间最小间隔 |
| `mix.generatedRatio` | 生成片段占比倾向 |
| `mix.music` | 背景音乐路径；`null` 为静音 |
| `mix.beats` | 节拍角色与比例 |

## 目录

```text
config/       主配置
modules/      scan / generate / mix / lib
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
- [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) — 依赖政策与登记
- [docs/DECISIONS.md](docs/DECISIONS.md) — 架构决策
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — 排错
- [STATUS.md](STATUS.md) — 当前状态与待办
- [CREDITS.md](CREDITS.md) — 素材来源与许可

## 素材与许可

品牌图标来自 Simple Icons（CC0 1.0），品牌标识归各平台所有，仅作类别示意。字体为 SIL OFL 1.1。世界点阵地图为 Public Domain。镜头卡来自 video-shotcraft（Apache 2.0）。完整来源与许可见 [CREDITS.md](CREDITS.md)。

生成片段是示意，不冒充实拍；手机 UI 等示意画面带「示意」标记。
