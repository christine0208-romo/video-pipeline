# QUALITY · pHash / 观感相似度 / 覆盖矩阵

生成素材的差异不能只看参数轴：不同 palette、不同创意工程仍可能看起来很像。质量模块从成片文件本身出发，计算感知哈希与画面指标，给出：

- 每条素材的 `quality`（pHash、alpha 覆盖率、运动能量、亮度/对比度、平均色）；
- 素材之间的观感相似度与感知簇；
- 按层 / 创意工程 / palette / variation 轴的覆盖矩阵；
- 近似重复对与质量警告；
- 混剪时的感知去重与质量闸门。

实现不引入图像依赖：ffmpeg 抽 32px 级原始帧，DCT 与指标都在 `modules/lib/vision.mjs` 里算。

## 1. 指标

| 指标 | 计算 | 用途 |
|---|---|---|
| `phash` | 32×32 灰度 → 2D DCT → 8×8 低频 → 中位数阈值 → 64 bit | 画面结构指纹 |
| `phashFrames` | 每段采样 8 帧，各算一次 | 对齐比较、避免单帧误判 |
| `alphaCoverage` | 透明 WebM 的 alpha > 阈值像素比例（96px 宽采样） | 判断叠加层是否为空/过淡 |
| `alphaEnd` | 末帧 alpha 覆盖率 | 判断转场是否回到透明 |
| `firstLastHamming` | **精确首帧**与**精确末帧**的 pHash Hamming 距离 | 判断循环是否闭合 |
| `endMotion` | 最后两帧的平均亮度差 | 判断末帧是否仍在运动 |
| `motionEnergy` | 相邻采样帧的平均绝对亮度差 | 判断素材是否几乎静止 |
| `brightness` / `contrast` | 灰度均值 / 标准差 | 判断黑屏、低对比 |
| `avgColor` | 平均 RGB | 颜色相似度 |

### 1.1 相似度

对两条同层素材：

1. 所有帧两两算 Hamming 距离，取最小值 `hammingMin`；
2. 按比例对齐两条帧序列，算平均距离 `hammingMean`；
3. 颜色距离归一化到 0–1；
4. `score = 0.85 × (1 − (0.6×mean + 0.4×min)/64) + 0.15 × (1 − colorDistance)`。

- `hammingMean ≤ clusterDistance`（默认 12）或 `score ≥ 0.9` → 同一感知簇。
- `score ≥ similarityThreshold`（默认 0.86）→ 近似重复。

用平均距离而不是只看最小距离，是因为同一底图的不同运镜（例如 `network-universe` 与 `camera-shake`）必然共享某些帧；只看最小距离会全部判成重复。

## 2. 命令

```bash
# 分析并写回 catalog，生成报告
node run.mjs quality

# 强制重算（阈值或指标实现变更后）
node run.mjs quality --force

# 只读已有 quality，不重新抽帧
node run.mjs quality --report-only

# 只看某一层 / 范围 / work
node run.mjs quality --layer overlay
node run.mjs quality --scope work
node run.mjs quality --work t3

# 检查某条成片引用的素材
node run.mjs quality --edl mix-20261119-1

# CI：有近似重复或质量失败时退出码 1
node run.mjs quality --strict

# 逐条列出指标
node run.mjs quality --list
```

`creative build` 与 `fission` 渲染完成后会自动分析本次渲染或缺失质量的素材；`--dry-run` 不分析。

## 3. 报告

- `data/quality/report.json`：机器可读，含 summary / layers / axes / matrices / clusters / nearDuplicates / flagged。
- `out/quality/report.md`：人读版，含按层表、近似重复表、覆盖矩阵、轴覆盖与质量标记。

覆盖矩阵当前包括：

| 矩阵 | 含义 |
|---|---|
| palette × layer | 每层实际用到的调色板 |
| creative × palette | 创意工程与调色板组合覆盖 |
| engine × layer | 引擎分布 |
| scope × layer | shared / work 分布 |

轴覆盖统计每个 variation 轴的取值数、归一化熵与分布；`category` / `series` 也作为独立轴统计。`n/a` 表示该素材没有 variation profile（shared preset 或早期 work 素材）。

## 4. 质量闸门

`quality.flags`：

| flag | 条件 | 是否阻止混剪 |
|---|---|---|
| `empty-alpha` | 透明素材 alpha 覆盖率 < `minAlphaCoverage`（0.001） | 是 |
| `blank` | 近黑且低对比 | 是 |
| `faint-alpha` | alpha 覆盖率 < `faintAlphaCoverage`（0.01） | 否，仅警告 |
| `alpha-unknown` | alpha 抽取失败 | 否，仅警告 |
| `loop-mismatch` | `loop = true` 但首尾帧 Hamming > `loopDistance` | 是 |
| `end-unsettled` | `complete = "hold"` / 文字末帧仍在运动 | 否，仅警告 |
| `end-residue` | `complete = "clear"` 的转场末帧 alpha > `clearAlpha` | 否，仅警告 |
| `static` | 运动能量 < `minMotionEnergy` | 否，仅警告 |

- `quality.ok === false` 的素材默认不进入混剪；用 `--allow-low-quality` 临时放开。
- planner 默认开启 `mix.perceptualDedupe`：同一条成片内，不与已用素材观感过分接近；用 `--no-perceptual-dedupe` 关闭。
- `quality --strict` 在任何近似重复或 `ok=false` 时失败，适合提交前检查。

## 5. 配置

```json
"quality": {
  "autoAnalyze": true,
  "sampleFrames": 8,
  "phashSize": 32,
  "alphaSampleWidth": 96,
  "alphaThreshold": 4,
  "minAlphaCoverage": 0.001,
  "faintAlphaCoverage": 0.01,
  "minMotionEnergy": 0.00002,
  "minContrast": 0.008,
  "loopDistance": 12,
  "settleMotion": 0.004,
  "clearAlpha": 0.02,
  "clusterDistance": 12,
  "similarityThreshold": 0.86,
  "maxSimilarityPairs": 24
}
```

- `alphaThreshold` 是缩放后的 alpha 阈值；alpha 单独用 `alphaSampleWidth`（默认 96px 宽）采样，不跟 32px 的 pHash 共用分辨率。
- 32px 级 area 缩放会把细粒子稀释到 0（实测 `work-20261121-3-particle-dust` 在 32px 下 max=4，96px 下 0.13% 可见像素）；96px 能区分极淡粒子和真正的空素材。
- `sampleFrames` 是上限；极短素材按 `duration × fps` 自动减少。

## 6. 边界

- pHash 对结构性差异敏感，对纯色/极简画面的区分度有限；最终仍需抽帧人工复查。
- 采样 8 帧是速度与稳定性的折中；非常短或运动极快的素材可能漏掉中间状态的差异。
- 近似重复不一定是错误：`camera-push` 与 `platform-orbit` 共用底图，会被标成同一感知簇；是否保留由创作者判断。
- 跨 work 的近似重复会出现在报告里，但 work 素材默认隔离，不影响普通混剪。
- 覆盖率是像素比例，不代表构图质量；`alphaCoverage` 高不等于画面好看。
- 报告不替代 `out/stills/` 与成片抽帧复查。
