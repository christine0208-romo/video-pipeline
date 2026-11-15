# PLAN · 核心框架与内容/素材彻底解耦

> 本文件是新会话的执行契约。新会话第一步：读 `STATUS.md`、`docs/RULES.md`、本文件，然后 `git status` 确认当前未提交状态。**不要 reset / checkout / 清理工作区**；当前有大量未提交改造，creative/ 与 common/assets 是本地内容。

## 0. 一句话目标

core 只保留“管理两个素材库 + 生产视频”的机制和运行时；不包含任何创意实现、默认素材清单、字体清单、音频清单或具体工程引用。用户放入内容包和素材后，通过扫描/同步命令自动识别、登记、构建。

判定标准：删除 `creative/`、`common/assets/` 后，core 仍然能安装、typecheck、check、doctor；恢复内容后能自动识别并生产。

## 1. 当前已完成（不要回退）

- `creative/` 已 gitignore，内容是本地创意包：11 个工程（5 个本地引擎 + 6 个共享引擎）、`creative/shared/`、`registry.ts`。
- `common/assets` 二进制已 `git rm --cached`，当前只有 `REGISTRY.json`、`sfx/index.json`、`music/index.json` 与 README/LICENSES 仍被跟踪。
- `src/generated` 已删除；`src/types.ts` 为新的核心类型；`common/engine/easing.ts` 为共享缓动。
- `common/components` 已删除；`GeneratedClip` 已移入 `creative/engines/ui-mock/clips.tsx`。
- `tools/init-creative.mjs`、`tools/assets.mjs`、`config/assets.manifest.json`、`npm run sync` 尚未完成的部分见下。
- 当前全量内容下 `npm run typecheck`、`npm run check`、`npm run doctor` 通过。
- 已知未提交/未跟踪：`creative/`（ignored）、`workbench/public/`、`src/types.ts`、`common/engine/easing.ts`、`tools/assets.mjs`、`tools/init-creative.mjs`、`config/assets.manifest.json`；`common/assets` 二进制是索引删除状态。

## 2. 目标边界（不可违反）

### core 可以有

- `run.mjs`、`modules/*`：scan / creative 编译器 / quality / mix / fission / catalog / lib；
- `src/`：Remotion 入口、`GeneratedAsset`、`MixVideo`、`platform`、通用类型；
- `workbench/`、`tools/`、`config/`、`docs/`；
- `common/engine`（运动/字体/Canvas 原语）、`common/vendor`（第三方/上游库）。

### core 不能有

- 任何具体画面实现（preset/atom、packs、GeneratedClip、示例引擎）；
- 任何具体创意工程、变体、文案池、调色板枚举、图标路径表、点阵地图；
- 任何默认素材清单（字体/图标/音效/BGM/品牌）；
- 任何具体项目的引用（如 `config/components.json` 里的 sim-card 条目）；
- 素材二进制。

### 内容/素材

- `creative/`：创意包（引擎实现、schema、变体、shared 内容）；
- `common/assets/`：运行时素材落点；
- `projects/`：成片项目包；
- `data/`、`out/`、`public/`、`release/`、`.cache/`：运行产物。

## 3. 工作包 A · 核心类型去内容化

### A1. 重写 `src/types.ts`

只保留：

```ts
export type EngineProps = {
  alpha?: boolean;
  [key: string]: unknown;
};

export type PresetMeta = {
  id: string;
  supportsAlpha: boolean;
  description: string;
  [key: string]: unknown;
};

export type AssetProps = {
  preset: string;
  props?: EngineProps;
  alpha?: boolean;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
};
```

删除 `PaletteName` 与旧 `PresetProps`。

### A2. 新建 `creative/shared/types.ts`

把旧 `PaletteName` 与各引擎 props 放到内容包：

- `PaletteName`（11 个色板）
- `TextProps`、`TransitionProps`、`ParticleProps`、`CameraProps`、`IconGlitchProps`、`UiMockProps`、`IconSceneProps`
- 每个都 `extends EngineProps`，字段全部 optional。

### A3. 更新引擎与注册表

- `creative/shared/palette.ts` 从 `./types` 取 `PaletteName`。
- 各引擎 `index.tsx` 从 `../../shared/types` 取自己的 props 类型（共享引擎与本地引擎深度相同）。
- `modules/creative/registry.mjs` 生成的注册表：
  - 从 `../src/types` import `EngineProps` / `PresetMeta`；
  - `Component` 类型为 `React.FC<EngineProps>`；
  - 组件赋值处加 `as React.FC<EngineProps>`（引擎自身类型可以是 `React.FC<TextProps>`）；
  - `metaOf` 返回宽松 `PresetMeta`。
- `src/GeneratedAsset.tsx` 只依赖 `AssetProps`，不再知道 text/palette 等字段。

验收：新增一个带新 props 的引擎时，不改 `src/` 任何文件，只改 `creative/`。

## 4. 工作包 B · 素材/字体/音频清单迁入内容包

### B1. 资产清单

- 把 `config/assets.manifest.json` 移到 `creative/shared/assets.manifest.json`（内容包，gitignored）。
- `tools/assets.mjs` 改为：
  - 默认 manifest：`creative/shared/assets.manifest.json`；
  - 支持 `--manifest <file>`；
  - manifest 或 asset root 不存在时，`check/fetch` 打印“无内容包”并以 0 退出（空核心合法）。
- 新增 `scan` 子命令：
  - `node tools/assets.mjs scan`：遍历 `common/assets`，与 manifest 比较，报告新增/变更/缺失；
  - `--apply`：新增条目写入 manifest（`kind` 从一级目录推断、`sha256`、`size`、`provided: true`、`source: "user"`、`license: "unknown"`）；
  - 哈希变化：报告；`--apply` 更新哈希；
  - 缺失：报告；`--prune` 才从 manifest 删除；
  - `check --strict`：license 为 `unknown` 时失败；普通 check 只警告。
- 删除 `common/assets/REGISTRY.json` 的跟踪与使用；许可/来源并入 manifest 条目。
- 更新 `tools/check.mjs`：不再要求 `common/assets/REGISTRY.json`；若 `creative/shared/assets.manifest.json` 存在，调用 `assets check`，否则跳过。
- 更新 `tools/doctor.mjs`：素材缺失只警告；提示 `npm run assets:fetch`。

### B2. 字体清单

- `common/engine/fonts.ts` 只保留 `useFonts`、`measureCN`、`FontSpec`；删除 `FONT_MANIFEST`。
- 新建 `creative/shared/fonts.ts`，导出 `FONT_MANIFEST`（Noto/Inter/JetBrains；需要的内容字体由内容包自行添加）。
- `modules/creative/registry.mjs` 生成 `FONT_MANIFEST`：
  - `creative/shared/fonts.ts` 存在则 re-export；
  - 否则导出 `[]`。
- `src/GeneratedAsset.tsx` 从 `../creative/registry` 同时取 `PRESETS` 与 `FONT_MANIFEST`。
- 确认空 manifest 时 `useFonts([])` 立即 ready（已核验实现）。

### B3. 音频索引

- 把 `common/assets/sfx/index.json` → `creative/shared/audio/sfx.index.json`；
  `music/index.json` → `creative/shared/audio/music.index.json`；
  `music/LICENSES.md` 同步移动。
- `modules/mix/planner.mjs`：
  - `resolveMusic` 读 `cfg.paths.creative/shared/audio/music.index.json`；
  - `buildSfx` 读 `.../sfx.index.json`；
  - 文件不存在或文件缺失时返回空（静音），不报错。
- 音频文件仍部署在 `common/assets/{sfx,music}`；EDL 的 `assets/sfx/...` 路径不变。

### B4. 清空 core 的素材清单

- `.gitignore` 改为忽略整个 `/common/assets/`（不再保留任何 tracked 文件）。
- 删除 `common/assets/REGISTRY.json`、`sfx/index.json`、`music/index.json`、README/LICENSES 的跟踪；内容移入 `creative/shared/`。
- `common/assets` 不存在时：
  - `ensurePublicLinks` 跳过 `public/assets`、`public/music` 链接并警告；
  - `tools/check` 跳过素材检查；
  - `doctor` 警告素材未部署。
- `CREDITS.md`：把素材许可段落移到 `creative/shared/CREDITS.md`；core CREDITS 只保留 engine/vendor/工具链。

### B5. 其他非核心内容

- `common/shots`（124 张镜头卡）是参考资料，不是运行时；移到 `creative/shared/shots/` 或移出仓库。
- `config/components.json` 删除具体项目条目（sim-card）；项目包由 `projects/*/project.json` 扫描发现。
- `common/` 最终只剩 `engine/` 与 `vendor/`。

## 5. 工作包 C · 自动扫描与同步

### C1. 新入口 `node run.mjs sync`

新增 `tools/sync.mjs`：

1. `creative scan --write-registry`（每次自动重写注册表）。
2. `assets scan`（默认报告；`--apply` 登记新文件）。
3. 可选 `scan`（`--footage`）。
4. 输出变更摘要：新增/修改/缺失的引擎、素材、工程。

参数：

```bash
node run.mjs sync                 # 报告，不改 manifest
node run.mjs sync --apply         # 写入 registry + 新素材登记
node run.mjs sync --check         # 只检查，不写；有差异退出 1
node run.mjs sync --footage       # 顺带扫描实拍
```

### C2. check 与构建前置

- `npm run check` 保持只读：执行 `sync --check`（registry 过期、素材差异、创意校验失败都算问题）。
- `npm run sync` 作为人工/工作台刷新入口。
- `creative build` 前若 registry 过期：自动调用 registry 生成（只写 `creative/registry.ts`），再编译。
- 素材不会自动 fetch；`build` 缺素材时按现有错误处理。

### C3. 工作台

- 新增 `POST /api/sync`：入队 `run.mjs sync --apply`。
- 创意页顶部增加“同步内容”按钮，显示 registry 是否过期、素材差异数量。
- `GET /api/creative` 已经每次重扫创意包；引擎注册表仍由 sync 写入。
- 可选后续：`fs.watch` 监听 `creative/` 与 `common/assets/`，变化时提示同步；本计划先不做自动 watch。

### C4. 手动修改后的行为（目标）

| 修改 | 是否需要 sync | 结果 |
|---|---|---|
| creative.json / variants 参数、文案 | 否 | loader 直接读取，build 生效 |
| 新增/删除引擎、本地 engine/ | 是（自动写 registry） | sync 后 build 可渲染 |
| 新增素材文件 | 是（assets scan --apply） | 自动登记，license=unknown 待人工 |
| 替换素材文件 | 是 | 哈希变化，scan 报告并更新 |
| 删除素材文件 | 是 | scan 报告缺失；不自动删条目 |
| 新增工程/项目 | 视项目机制 | projects 扫描另行接入 |
| 生成素材/catalog | 否 | build/quality 自动写 |

## 6. 工作包 D · 项目扫描（可选但建议）

- 新增 `tools/projects.mjs`：扫描 `projects/*/project.json`，校验 id、目录、脚本入口；`node run.mjs projects scan`。
- `config/components.json` 只保留工具/运行时组件，不再列具体项目。
- 本次不强制接入 mix；先做到“能发现、能列出、能校验”。

## 7. 删除/迁移清单

| 文件/目录 | 动作 |
|---|---|
| `src/types.ts` | 重写为通用类型 |
| `creative/shared/types.ts` | 新建，接收 PaletteName/引擎 props |
| `modules/creative/registry.mjs` | 改类型 import 与 `FONT_MANIFEST` 生成 |
| `src/GeneratedAsset.tsx` | 从 creative registry 取字体 |
| `config/assets.manifest.json` | 移到 `creative/shared/assets.manifest.json` |
| `common/engine/fonts.ts` | 删除 FONT_MANIFEST |
| `common/assets/*` | 全部内容化；core 不再跟踪 |
| `common/assets/REGISTRY.json`、`sfx/index.json`、`music/index.json` | 移到 `creative/shared/` |
| `modules/mix/planner.mjs` | 音频索引改读内容包 |
| `tools/check.mjs` / `doctor.mjs` / `public.mjs` | 空资产容错 |
| `common/shots` | 移入内容包或移出仓库 |
| `config/components.json` | 删除具体项目 |
| `package.json` | 增加 `sync`、`assets:scan` 脚本 |

## 8. 验证矩阵

### 空 core（无 creative、无 assets）

```bash
npm ci
npm run assets:check        # 0 条，退出 0
node run.mjs sync --check   # 通过
npm run typecheck
npm run check
npm run doctor              # 仅素材未部署警告
node run.mjs creative build # 明确报“没有可编译素材”
```

### 全量内容

```bash
npm run assets:check
npm run assets:verify
node run.mjs sync --apply
node run.mjs creative scan --check-registry
node run.mjs creative build --creative text-display --dry-run
npm run typecheck
npm run check
node run.mjs check
```

### 手动修改场景

1. 新增一个本地引擎 + 工程 → `sync` 自动写 registry；`creative preview` 成功。
2. 新增一个图标文件 → `assets scan` 报告新增；`--apply` 登记，license=unknown；`check --strict` 失败直到补许可。
3. 替换一个字体文件 → `assets scan` 报哈希变化；`--apply` 更新。
4. 修改变体文案 → 不运行 sync，`creative build` 直接生效。
5. 删除引擎目录 → `sync` 移除 registry 条目；build 不再列出。
6. 空 core 全流程仍通过。

## 9. 风险与决策

- **类型泛化会降低引擎内部类型安全**：引擎在自己的 `creative/shared/types.ts` 里保持精确类型；core 只做透传，不允许把具体字段加回 `src/types.ts`。
- **资产自动登记不能猜许可**：新条目 `license=unknown`，`check --strict` 必须失败；普通 check 警告。
- **素材自动删除危险**：scan 默认只报告；`--prune` 才删 manifest 条目，且不删文件。
- **注册表生成是写操作**：`sync` 写，`check` 只读；`build` 可在 registry 过期时自动写。
- **空核心不是错误**：没有内容包时所有命令应给出“无内容”提示并成功，除了需要渲染素材的构建/混剪。
- **不要回退当前未提交改造**：先看 `git status`；creative 与 common/assets 本地内容不能丢。

## 10. Done 定义

- `src/` 中不存在任何调色板名称、引擎专有 props、素材路径或字体清单。
- `config/` 中不存在默认素材清单或具体项目引用。
- `common/` 只剩 `engine/` 与 `vendor/`。
- 空 core 能 npm ci / typecheck / check / doctor / sync --check。
- 放入任意 creative 包与素材后，`sync --apply` 能自动识别并登记；build/preview/mix 正常。
- 手动新增/替换/删除文件有明确的 scan/check 行为，不依赖人工改源码。
- `STATUS.md`、`docs/MODULES.md`、`docs/CREATIVE.md`、`docs/ASSETS.md`、`CREDITS.md` 与新边界一致。
