# SHARED · 公共资源层与素材库规范

`shared/` 与 `assets/` 是**系统与用户共同维护**的区域：系统负责结构、模板、校验、统计与同步；用户负责资源本体与许可信息。两者都不进仓库，但结构与规范随核心分发。

```bash
node run.mjs shared init      # 新机器/新项目：生成结构
node run.mjs shared status    # 随时查看：条目数、缺失、未登记
node run.mjs shared validate  # 提交前校验；--strict 把缺失也算失败
```

## 1. 所有权矩阵

| 位置 | 必需 | 系统负责 | 用户负责 |
|---|---|---|---|
| `shared/README.md`、`CREDITS.md` | 否 | 模板、结构 | 许可与署名内容 |
| `shared/assets.manifest.json` | 否 | 生成、哈希、比对、校验 | 补 `license` / `source` / `url` |
| `shared/fonts.ts` | 否 | 模板、文件存在性校验 | 清单条目与字体文件 |
| `shared/audio/sfx.index.json` | 否 | 结构、id/文件校验 | 条目、增益、类别、文件 |
| `shared/audio/music.index.json` | 否 | 结构、id/文件校验 | 曲目、BPM、情绪、文件 |
| `shared/audio/LICENSES.md` | 否 | 模板 | 署名要求 |
| `shared/presets/design.ts` | 否 | 模板 | 设计令牌、平台避让（如 TikTok） |
| `shared/presets/canvas.ts` | 否 | 模板 | 是否给 Canvas 助手注入配置 |
| `shared/code/*` | 否 | 目录说明 | 公共代码（types / palette / parts…） |
| `shared/shots/*` | 否 | 目录说明 | 镜头卡文档 |
| `shared/variation.json` | 否 | 模板 | 裂变变化轴 |
| `assets/roots`（`assets.roots`） | 否 | 建目录、扫描、登记、校验 | 放文件、替换文件、删除文件 |

**系统约定**：`shared init` 只创建缺失文件，绝不覆盖已有内容；`--force` 才会用模板重写。系统命令不修改用户的清单条目、预设数值或代码。

## 2. 目录结构

```text
shared/
  assets.manifest.json     素材清单：path / kind / sha256 / size / license / source / url / provided
  fonts.ts                 FONT_MANIFEST（file 相对 public，如 assets/fonts/x.otf）
  audio/
    sfx.index.json         { version, items: [{ id, file, category, gain, duration, license, source }] }
    music.index.json       { version, tracks: [{ id, file, bpm, mood, energy, duration, license }] }
    LICENSES.md
  presets/
    design.ts              VIDEO / SAFE / COLORS / TYPE / GRID / MOTION
    canvas.ts              用设计令牌配置 Canvas 绘制助手
  code/                    可选的公共代码
    types.ts               引擎 props 类型
    palette.ts / parts.tsx / backdrop.tsx / assets.ts / icons.json / world-dots.json
  shots/                   镜头卡文档
  variation.json           裂变变化轴
  README.md
  CREDITS.md
```

`assets/` 本身没有强制层级，建议按用途分一级目录：`fonts/`、`icons/`、`music/`、`sfx/`、`brand/`、`map/`。`scan --apply` 用一级目录推断 `kind`。

## 3. 生命周期

```text
shared init → 放入素材 → sync --apply（登记 + 注册表）→ shared status
                                              ↓
                                   check / validate / build / mix
```

1. **初始化**：`shared init` 生成缺失文件与素材根目录。
2. **添加素材**：文件放进任意素材根（或工程的 `assets/`）。
3. **登记**：`node run.mjs sync --apply` 扫描素材根并写入清单（新条目 `license=unknown`）。
4. **补许可**：编辑清单条目的 `license` / `source` / `url`，更新 `CREDITS.md`。
5. **校验**：`shared validate`；提交前用 `--strict`。
6. **替换/删除**：替换同名文件后重新 `scan --apply`（更新哈希）；删除文件后 `scan --apply --prune` 移除条目（不删文件）。
7. **部署到新机器**：`shared init` → `npm run assets:fetch`（有直链的自动下载）或 `-- --from <dir>`；无清单时先放文件再 `scan --apply`。

## 4. 命令

| 命令 | 作用 |
|---|---|
| `node run.mjs shared init [--force]` | 生成缺失结构与素材根 |
| `node run.mjs shared status` | 只读：清单、字体、音频、预设、代码、镜头卡、工程素材、素材根 |
| `node run.mjs shared validate [--strict]` | 结构/JSON/引用校验；strict 把缺失与未登记许可算失败 |
| `node run.mjs sync --apply` | 写注册表 + 登记新素材 |
| `npm run assets:check` / `assets:verify` | 缺失检查 / SHA-256 校验 |
| `npm run assets:scan` | 磁盘与清单差异 |
| `npm run assets:fetch` | 按清单下载或 `--from` 部署 |
| `npm run check` | 含 `shared validate`（shared 存在时） |

## 5. 素材库（assets/）

- **多根**：`config/pipeline.json` 的 `assets.roots`（默认 `["assets"]`），机器相关路径写 `config/local.json`；`--asset-roots a,b` 可临时覆盖。
- **合并**：按根顺序合并到 `public/assets`；同名单目录递归合并，同一相对路径由前一个根优先。
- **引用**：内容写相对路径（`icons/x.svg`）或 `assets/...`；工程自带素材写 `project/...`。
- **许可**：新文件默认 `license=unknown`；`check --strict` 会拦住。不自行推断许可。
- **删除**：不会自动删除文件；`--prune` 只删清单条目。
- **项目自带素材**：`creative/<id>/assets/`，不登记共享清单，跟随工程目录移动。

## 6. 空核心与部分内容

| 状态 | 行为 |
|---|---|
| 无 `shared/` | `shared status/validate` 提示未初始化并正常退出；`check` 跳过；渲染无字体、无素材 |
| 有 `shared/` 无素材 | `validate` 警告缺失；`assets check` 报缺失；渲染时缺少的资源按错误处理 |
| 有素材无清单 | `assets check` 报“N 个文件未登记”；`scan --apply` / `sync --apply` 生成清单 |
| 清单与磁盘不一致 | `status` 显示新增/变更/缺失；`sync --check` 退出 1 |

## 7. 系统更新如何触达这个区域

- 结构、模板、校验与统计都在核心（`docs/architecture/SHARED.md` + `tools/shared.mjs`），不依赖用户目录里的文件；更新核心后 `shared init` 会补齐新增的缺失文件。
- 系统不静默修改用户内容；需要结构变化时提升 `version` 并提供迁移说明，迁移命令在实现前不会自动执行。
- 当前清单/音频索引的 `version` 为 `1`。

## 8. 用户规则

1. 只通过命令改清单结构；不要手写 `sha256`。
2. 新素材先放文件，再 `scan --apply`，最后补许可。
3. 不覆盖别人正在引用的文件；替换时保持相对路径不变。
4. 公共代码只放被 2 个以上工程复用的部分，单工程代码放工程目录。
5. 平台预设（TikTok 等）放 `presets/`，不要写进核心。
6. `shared/shots` 是参考文档，不参与运行时。
7. 需要新素材根时改 `config/local.json`，不要改 `pipeline.json` 的共享默认值。
8. 发布前跑 `shared validate --strict` 与 `npm run check`。
