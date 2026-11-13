# FISSION · 作品级生成素材隔离与缓存

> 2026-11-09 起，裂变默认**不再生成 work 专属素材**：直接从 shared 生成素材库 + 实拍库取用。需要作品专属素材时加 `--with-assets`。`mix --work` 也不再强制使用 work 素材。

裂变不是把同一条时间线换 seed，而是每个作品拥有自己的**编排**。默认复用 shared 素材库；只有显式 `--with-assets` 时才为单个作品生成独立素材。不同作品之间默认不复用 work 素材，只有用户手动提升为 shared 的素材才跨作品可用。清理由用户手动执行。

## 0. 两种模式

| 模式 | 命令 | 素材来源 | 适用 |
|---|---|---|---|
| shared（默认） | `node run.mjs fission --works 3` | 现有 shared 目录 + 实拍库 | 批量生产、节省渲染时间 |
| work-local | `node run.mjs fission --works 3 --with-assets` | 每个作品新生成 scene/overlay/transition | 需要作品专属画面 |

- shared 模式下 `--per-layer` 会被忽略并给出警告。
- work-local 模式沿用下面的缓存、隔离与清理逻辑。
- `mix --work <id>` 在两种模式下都可用；没有 work 素材时只用 shared。
- `mix.requireWorkAsset` 默认 `false`；需要强制专属素材时加 `--require-work-asset`。

## 1. 核心模型

| 概念 | 规则 |
|---|---|
| Work ID | `work-<seed>-<n>`，也可用 `--work <id>` 指定；同一 ID 重跑复用缓存 |
| Work seed | 默认由 Work ID 派生（`seedFrom(workId)`）；`--work-seed` 可覆盖 |
| 素材 scope | `work` 只对所属作品可见；`shared` 对所有作品可见 |
| Work 素材 | 生成时自动 `approved`，但 `scope = work`；不同作品无法选到 |
| Shared 素材 | 现有已审核 preset / atom，或用户 `--share` 提升的 work 素材 |
| 缓存 | 素材 ID 含 workId + props hash；文件存在即命中，`--force` 才重渲 |
| 清理 | 手动 `generate --clean-work <id>`；默认 dry-run，`--force` 才删除 |
| 自动清理 | 不存在 |

### 1.1 变化轴

recipe 只是“动词”。每个 work 还会从 `src/generated/variation.json` 抽一组独立轴：

| 轴 | 取值 |
|---|---|
| 调色板 | 10 套：aurora / ember / mono / lime / ice / violet / ocean / sand / candy / forest |
| 文本版式 | align / vertical / maxWidth / lineHeight / letterSpacing |
| 文本背景 | none / glow / grid / dots / gradient + 光位 |
| 文本内容 | 10 条文案 + 关键词 + 数字 |
| 字体层级 | fontSize / fontWeight |
| 粒子分布 | random / radial / grid / linear + colorMix + size / speed |
| 粒子背景 | none / glow / grid / dots / gradient + 光位 |
| 镜头底图 | 6 个 basePreset + icon pool / subset |
| 镜头后处理 | none / grain / vignette / scanline + grade |
| 转场 | angle / intensity |
| 时长 | text / particle / camera / transition 各自的帧数档 |
| 节奏 | hook-first / proof-heavy / slow-build / punchy |
| 实拍主题 | cards / signup / showcase / mixed；按 tags 过滤，不足 5 条回退全池 |

- 这些轴由 workSeed 选择；调色板、节奏、素材主题用独立 hash，避免轴之间相关性。
- 选择结果写入 catalog 的 `variation` 字段和 EDL 的 `variation` / `workProfile`，方便复查与覆盖统计。
- 同一 recipe 在不同 work 里可以呈现完全不同的版式、背景、光色、文案和镜头底图；这比只加 recipe 更能扩大观感差异。

## 2. 裂变流程

```text
fission --works N --seed S
  └─ for each work:
       1. workId = work-S-n，workSeed = seedFrom(workId)
       2. 从完整 recipe pool 按 layer 选 scene / overlay / transition
       3. 按 workSeed 选 axes、palette、text、参数抖动
       4. 构建 catalog 条目（scope=work, status=approved）
       5. 渲染 MP4 / 透明 WebM / 静帧；已存在则命中缓存
       6. mix --work workId：只用 shared + 当前 work 素材
       7. 产出 data/edl/workId.json、out/workId.mp4
```

## 3. 命令

```bash
# 默认：3 个作品，只使用 shared 素材库
node run.mjs fission --works 3 --seed 20261118 --duration 12

# 作品专属素材：显式加 --with-assets
node run.mjs fission --work t1 --duration 6 --with-assets --per-layer 1,1,1

# 批量裂变 + 专属素材
node run.mjs fission --works 3 --seed 20261118 --duration 12 --with-assets --per-layer 1,2,2

# 微调 / 重渲单个作品（复用已缓存素材；没有 work 素材时用 shared）
node run.mjs mix --work work-t1 --duration 6

# 强制重渲该作品的专属素材
node run.mjs fission --work t1 --duration 6 --with-assets --per-layer 1,1,1 --force

# 查看作品素材
node run.mjs generate --list-works

# 把 work 素材提升为 shared
node run.mjs generate --share <assetId,...>
node run.mjs generate --share all-work:work-t1

# 清理 work 素材（默认只列出，不删除）
node run.mjs generate --clean-work work-t1
node run.mjs generate --clean-work work-t1 --force
```

## 4. 隔离保证

- Work 素材 ID 的 `idBase` 含 workId；不同作品不会命中同一文件。
- Work seed 影响 recipe 的 palette / text / seed / 参数抖动；同 recipe 在不同作品里也会产生不同画面。
- `mix` 的 catalog 过滤：普通混剪只看 `shared`；`mix --work` 只看 `shared + 当前 workId`。
- planner 优先 work-local 素材；没有 work 素材时使用 shared；只有 `mix.requireWorkAsset = true` 时才要求至少一条 work 素材。
- `--share` 是唯一的跨作品提升方式；提升后保留 `workId` 作为来源。

## 5. 缓存与清理

- 同一 workId / workSeed 重跑：素材 ID 相同，文件存在 → 缓存命中。
- 改 recipe 参数：props hash 变化 → 新 ID；旧条目保留，直到手动清理。
- `--clean-work`：
  - 只删 `scope=work` 且 workId 匹配的条目和文件；
  - 已提升 shared 的素材不删；
  - 默认 dry-run；`--force` 才删除；
  - 会提示仍引用这些素材的 EDL；
  - 会移除该 work 在 `signatures.json` 里的输出记录。
- 不自动清理，不按保留期删除。

## 6. 配置

```json
"fission": {
  "works": 1,
  "seed": 20261108,
  "duration": null,
  "assetsPerLayer": {
    "scene": 1,
    "overlay": 2,
    "transition": 2
  },
  "recipePool": "all"
}
```

- `duration: null` 使用 `mix.duration`。
- `recipePool: "all"` 使用完整 recipe 库；也可配置成 recipe id 数组。
- `--per-layer scene,overlay,transition` 覆盖每层数量。
- `--scene / --overlay / --transition` 单独覆盖对应层。

## 7. 边界

- Recipe 池只是“动词”；差异主要来自 variation 轴的版式/背景/光色/文案/镜头/节奏/素材主题，以及 recipe 选择。继续加 recipe 仍有价值，但不是唯一杠杆。
- 文字文案现在来自 `variation.json` 的 10 条 copy 池；仍可能重复，后续应接入按主题生成的文案源。
- 变化轴很多；`node run.mjs quality` 会给出感知簇、近似重复与覆盖矩阵，混剪默认启用同片感知去重与质量闸门（见 `docs/QUALITY.md`）。
- 跨 work 的近似重复仍可能出现；报告会列出，但 work 素材默认隔离，不会在同一条普通混剪里相遇。
- 变化轴过多会稀释品牌识别度；应保留字体、留白、主色等基线。
- work-local 模式下每个 work 素材需要 MP4 +（可选）WebM + 2 静帧；fission 串行渲染，耗时不短。用 `--per-layer` 控制规模；默认 shared 模式不生成素材，速度快很多。
- `--clean-work` 不删除作品成片和 EDL；需要时手动删除。
- 提升 shared 的素材会跨作品复用，失去“一次性”隔离；提升前确认通用度和质量。
