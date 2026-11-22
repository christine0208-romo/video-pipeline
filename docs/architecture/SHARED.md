# SHARED · 公共资源层与素材库

`shared/` 与 `assets/` 是**系统与用户共同维护**的区域。系统负责结构、默认内容、校验、统计与同步；用户负责资源本体与许可信息。

## 1. 资源从哪里来

| 内容 | 来源 | 获取方式 |
|---|---|---|
| 结构、模板（空清单、字体清单、音频索引、设计令牌、公共代码目录） | 核心 | `node run.mjs shared init` 生成缺失文件 |
| 字体、图标、地图、音乐、音效等二进制 | 用户提供，或清单里的 `url` | `node tools/assets.mjs add <文件\|目录\|URL>`，或 `npm run assets:fetch` |
| 创意工程、作品专属素材 | 独立创意包 / 用户 | 放入 `creative/`；素材放 `assets/` 或工程内 `assets/` |

核心**不携带**任何资源二进制、素材清单内容或创意实现；这些由内容包或用户提供。系统只提供结构、命令与校验。镜头卡是创意参考，随文档在 `docs/reference/shots/`，不属于 `shared/`。

常见公开来源（自行确认许可并填入 `--license`）：Simple Icons（CC0）、Lucide（ISC）、Google Fonts / Noto CJK（OFL）、Kenney（CC0）、AERIS MUSIC（CC0）、Kevin MacLeod（CC BY，需署名）。

## 2. 所有权矩阵

| 位置 | 必需 | 系统负责 | 用户负责 |
|---|---|---|---|
| `shared/assets.manifest.json` | 否 | 生成、哈希、比对、校验；字体条目自动补 `family/weight` | 按需补 `license` / `source` / `url`（可选） |
| `shared/fonts.ts` | 否 | **从清单字体条目生成**（`shared fonts --write`、`add`、`scan --apply` 自动触发） | 不手改；family 不对时用 `assets font set` |
| `shared/requirements.json` | 否 | 模板、`shared requirements` 校验 | 声明需要的字体族、音效类别、BGM 情绪、kind 数量（内容侧，允许手改） |
| `shared/audio/{sfx,music}.index.json` | 否 | 结构、id/文件校验、`file` 解析 | 用 `audio scan/set` 维护条目（不建议手改） |
| `shared/presets/design.ts`、`canvas.ts` | 否 | 模板 | 设计令牌、平台避让（如 TikTok） |
| `shared/code/*` | 否 | 目录说明 | 公共代码（types / palette / parts…） |
| `shared/variation.json` | 否 | 模板 | 裂变变化轴 |
| `shared/CREDITS.md` | 否 | 从清单生成 | 一般不需要改 |
| `assets/{fonts,icons,music,sfx,brand,map}` | 否 | 建目录、扫描、登记、校验 | 放文件、替换文件、删除文件 |

**系统约定**：`shared init` 只补缺失文件，不覆盖已有内容；`--force` 才用模板重写。系统命令不改用户的清单条目、预设数值或代码。`license` / `source` 是可选字段，只有分发 CC BY 等需要署名的素材时才建议填写。

**记账文件与创作文件**：由命令写的文件（清单、`fonts.ts`、音频索引、`CREDITS.md`、`creative/registry.ts`、`data/` 与 `out/` 产物）属于记账文件，必须能由命令重建，不允许“系统生成但用户必须手改才能工作”；`presets/*`、`variation.json`、`shared/code/*`、`creative/<id>/*`、`projects/<id>/*` 属于创作文件，允许手改。

## 3. 目录结构

```text
shared/
  assets.manifest.json     素材清单：path / kind / sha256 / size / license / source / url / provided；
                           字体条目另有 family / weight / style；市场导入另有 provider / providerRef
  fonts.ts                 生成物：FONT_MANIFEST（file 相对 public，如 assets/fonts/x.otf）
  requirements.json        内容侧资源需求：字体族 / 音效类别 / BGM 情绪 / kind 数量
  audio/                   sfx.index.json、music.index.json、LICENSES.md；
                           条目 file 为相对素材根路径（music/x.mp3、custom/intro.wav）
  presets/                 design.ts（VIDEO/SAFE/COLORS/TYPE/GRID/MOTION）、canvas.ts
  code/                    types / palette / parts / backdrop / assets / icons.json / world-dots.json / canvas-engine
  variation.json           裂变变化轴
  CREDITS.md               由清单生成
  README.md

assets/                   素材根（可多根）
  fonts/ icons/ music/ sfx/ brand/ map/   一级目录决定 kind；
  其他目录按扩展名推断（`add --keep` 时保留原结构）
```

### 资源需求（requirements.json）

```json
{
  "version": 1,
  "fonts": [{ "family": "Noto Sans SC", "weights": ["400", "700"] }],
  "audio": { "sfx": ["impact", "whoosh", "tap"], "musicMoods": ["calm"] },
  "kinds": { "icon": 10 }
}
```

- `fonts` 支持 `{ family, weight? }` 或字符串；按清单字体条目的 `family/weight` 比对。
- `audio.sfx` 比对音效索引的 `category`；`audio.musicMoods` 比对 BGM 的 `mood`。
- `kinds` 按清单条目数量比对（`fonts`/`icons` 等复数写法会归一）。
- 文件可选；未声明时命令返回 `declared=false`，不阻断。

## 4. 标准流程

```bash
node run.mjs shared init          # 生成 shared/ 结构与素材目录（空清单）
node tools/assets.mjs add <文件|目录|URL> [更多目标...] --license <许可> --source <来源>   # 字体/音频自动维护索引
node run.mjs shared fonts --write # 从清单字体条目重写 shared/fonts.ts（add/scan 已自动调用）
node run.mjs shared requirements  # 按 requirements.json 报告资源缺口
node run.mjs shared status        # 看缺口
node run.mjs shared credits --write --force   # 从清单生成 CREDITS
node run.mjs shared validate --strict
```

用户自己新增素材：

```bash
# 放入 assets/<kind>/ 后
node run.mjs sync --apply         # 登记新文件（license/source 可选；字体清单同时更新）
# 或直接由 add 复制并登记
node tools/assets.mjs add <文件|目录> [--keep] --license <许可>
# 字体 family 推断不准时
node tools/assets.mjs font set fonts/x.woff2 --family "Inter" --weight 600
# 补清单条目 license/source，再
node run.mjs shared credits --write --force
node run.mjs shared validate --strict
```

## 5. 冲突与一致性规则

| 情况 | 系统行为 | 用户处理 |
|---|---|---|
| 同一相对路径出现在多个素材根 | 按 `assets.roots` 顺序，前一个根优先；`status`/`scan` 报告被遮蔽项 | 调整根顺序，或把文件改到不同路径 |
| 磁盘有文件、清单没有 | `check` 报“未登记”，`scan --apply` 可登记 | 确认许可后登记 |
| 清单有、磁盘没有 | `check` 报缺失；`scan --apply --prune` 移除条目（不删文件） | 部署文件或 prune |
| 文件被替换 | `check --verify`/`scan` 报哈希变化；`scan --apply` 更新 | 确认替换原因后更新 |
| `license=unknown` | 不检查、不阻断 | 可选：需要署名时补上 |
| 工程自带素材与公共素材同名 | 互不影响：`project/...` 只解析到工程 `assets/` | — |
| 手工改了 `CREDITS.md` | 下次 `credits --write` 会覆盖 | 许可/来源改清单，不直接改 CREDITS |
| 手工改了 `fonts.ts` | `shared fonts --write` 或下次 `add`/`scan` 会覆盖 | 改清单字体条目，或用 `assets font set` |
| `add --keep <目录>` | 目录内容按原结构复制到首个素材根，不按扩展名归类 | 需要标准目录时不要加 `--keep` |
| 同一路径重复 `add` | 已存在且无 `--force` 时跳过 | 需要覆盖时加 `--force` |
| 音频索引 `file` 找不到 | 含 `/` 的按原路径、再按 `kind/原路径`；裸文件名按 `kind/名`、再按原名 | 用 `audio scan --apply` 重新登记 |

**唯一事实来源**：许可与来源在 `assets.manifest.json`，`CREDITS.md` 是生成物；素材文件在 `assets/`，清单是索引。

## 6. 命令

| 命令 | 作用 |
|---|---|
| `node run.mjs shared init [--force]` | 生成缺失结构、建素材根与标准目录、回填字体元数据、生成 CREDITS、更新注册表 |
| `node tools/assets.mjs add <文件\|目录\|URL> [...] [--keep]` | 复制/下载并自动登记（支持多个目标）；`--keep` 保留目录原结构；字体自动生成 `fonts.ts`，音频自动编入索引，并更新 CREDITS |
| `node tools/assets.mjs remove <path> [--keep-file]` | 取消清单/音频索引登记，同步 `fonts.ts` 与 CREDITS；默认删除磁盘文件，`--keep-file` 仅取消登记 |
| `node tools/assets.mjs font list` | 列出清单里的字体条目与 family/weight |
| `node tools/assets.mjs font set <path> [--family\|--weight\|--style]` | 修正字体元数据并重写 `shared/fonts.ts` |
| `node tools/assets.mjs audio scan [--apply]` | 扫描所有素材根中的音频文件，登记未编入索引的条目（时长用 ffprobe） |
| `node tools/assets.mjs audio set <id> [--category\|--gain\|--bpm\|--mood\|--energy\|--roles]` | 修改索引条目 |
| `node tools/assets.mjs audio list` | 列出音乐/音效索引 |
| `node run.mjs shared fonts [--write] [--json]` | 从清单字体条目生成 `shared/fonts.ts`（dry-run 打印） |
| `node run.mjs shared requirements [--json] [--strict]` | 按 `shared/requirements.json` 报告字体/音效/BGM/kind 缺口 |
| `node tools/assets.mjs check [--verify] [--strict] [--json] [--licenses] [--meta]` | 缺失、未登记、哈希、许可未知、字体/音频元数据缺失 |
| `node run.mjs shared status [--json]` | 清单/字体/音频/预设/代码/工程素材/素材根 |
| `node run.mjs shared validate [--strict] [--json]` | 结构/JSON/引用校验 |
| `node tools/assets.mjs init` | 只建素材根与一级目录 |
| `node tools/assets.mjs credits [--write] [--force]` | 从清单生成 `shared/CREDITS.md` |
| `node tools/assets.mjs scan [--apply] [--prune]` | 登记/更新/移除条目 |
| `npm run assets:fetch [-- --from <dir>]` | 按清单部署二进制 |
| `node run.mjs sync --apply` | 注册表 + 清单 + 可选实拍 |

**清单即锁定记录**：`path / size / sha256 / url / license / source`（市场导入另带 `provider / providerRef`）。`assets:fetch` 下载后按 `sha256` 校验，不符则不落盘并计入失败；`check --verify` 校验落盘文件与清单一致。

复现：换机在线 → 拿到内容包 `shared/`（清单）→ `npm run assets:fetch` → `check --verify --strict`；断网 → `npm run assets:fetch -- --from <dir>` → `check --verify`，清单里的 `url` 不被访问。只有清单、无网络无副本时无法复现二进制。

## 7. 空核心与部分内容

| 状态 | 行为 |
|---|---|
| 无 `shared/` | `init` 物化默认包；`status/validate` 提示未初始化；`check` 跳过 |
| 有 `shared/` 无二进制 | `status` 显示缺失；`check` 报缺失；`assets:fetch` 补齐 |
| 有素材无清单 | `check` 报未登记；`sync --apply` 生成清单 |
| 清单与磁盘不一致 | `status` 显示新增/变更/缺失；`sync --check` 退出 1 |

## 8. 系统更新如何触达

- 结构、模板、校验与统计都在核心（`tools/shared.mjs` + `docs/architecture/SHARED.md`），不依赖用户目录里的文件；核心升级后重跑 `shared init` 会补齐新增缺失文件。
- 核心不携带资源内容；资源由用户或内容包提供，系统只负责登记、校验与生成 CREDITS。
- 系统不静默改用户内容；需要结构变化时提升 `version` 并提供迁移说明。
- 清单/音频索引当前 `version` 为 `1`。

## 9. 用户与 Agent 操作清单

- 用户：初始化 → add/fetch/放素材 → `shared credits --write`（可选）→ `validate --strict` → 使用。
- Agent：`shared status --json` 看缺口，`shared validate --json --strict` 自检；不手改清单结构，需要新资源时报告缺口，由用户 add 或 fetch。
- 镜头卡：只有设计新引擎/变体时按 `docs/reference/shots/INDEX.md` 查 1–3 张，不整目录读。
