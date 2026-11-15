# CREATIVE · 创意工程

生成式素材的唯一来源。一个创意工程 = 一个意图 + 一套可调参数 + 1-n 个变体；每个变体产出 1-n 条素材。引擎实现可以在 `creative/` 里（共享引擎或创意本地引擎），参数、内容、变体都是 JSON。

## 1. 目录

```text
creative/
  registry.ts                # 自动生成的引擎注册表 + FONT_MANIFEST（scan --write-registry）
  shared/                    # 创意共用内容（随创意包部署）
    assets.ts                # 图标组路径与 worldDots 导出
    icons.json               # 图标路径目录
    palette.ts               # 调色板
    parts.tsx                # IconTile / Caption / DotGrid
    backdrop.tsx             # 文本/粒子背景
    world-dots.json          # 世界点阵
    variation.json           # 裂变变化轴
    types.ts                 # 内容类型：PaletteName 与各引擎 props
    fonts.ts                 # FONT_MANIFEST（字体清单）
    assets.manifest.json     # 素材清单（路径 / 哈希 / 许可 / 下载地址）
    audio/                   # sfx.index.json、music.index.json、LICENSES.md
    shots/                   # 镜头卡文档（参考资料，不参与运行时）
    CREDITS.md               # 素材与许可
  engines/<engine>/          # 共享引擎：只放被 2+ 创意复用的实现
    engine.json              参数、style、元数据
    index.tsx                实现，导出 Component
  <creative-id>/
    creative.json            意图、引擎引用、适用实拍条件、默认参数
    engine/                  本地实现（默认）
      engine.json
      index.tsx              实现，导出 Component
    variants/<variant>.json  风格 + items；每个 item 产出一条素材
    README.md                设计意图与验收标准
```

类型边界：核心只有 `src/types.ts` 的 `EngineProps / PresetMeta / AssetProps`（全部允许额外字段）；每个引擎的精确 props 类型写在 `creative/shared/types.ts`，引擎从 `../../shared/types` 取自己那一个。新增引擎只需要能在 `creative/` 里通过类型检查，不改 `src/`。

素材引用：创意参数与引擎默认值里写相对素材路径（`icons/whatsapp.svg`），渲染前由 `assetPath()`（`common/engine`）规范成 `assets/...`；已带 `assets/` 前缀或绝对 URL 的原样保留。素材根由 `config/pipeline.json` 的 `assets.roots` 决定（默认 `assets/`，可多根，按顺序合并）。

依赖方向：内容只依赖 core 的 `common/engine`（运动/Canvas/字体原语）与 `src/types`（通用契约），不要从 `src/platform`、`modules/` 或 `workbench/` 取东西。core 只通过 `creative/registry.ts` 读取内容。


引擎引用：

- 默认 `engine: "./engine"` → 使用创意工程自己的 `engine/`；
- `engine: "<id>"` → 使用 `creative/engines/<id>/` 的共享引擎；
- **本地优先，复用再提升**：只有第二个创意要用同一引擎时，才把 `engine/` 整体移到 `creative/engines/`，两边改成 `engine: "<id>"`。是移动，不是复制。

当前 `platform-orbit`、`social-constellation`、`network-universe`、`kinetic-grid`、`icon-morph`、`ui-mock` 是共享引擎，因为 `camera` 引擎把它们当作底图；其余引擎跟随各自创意工程。

新增、移动或删除引擎后运行：

```bash
node run.mjs creative scan --write-registry
```

`npm run check` 会校验注册表是否最新。

## 2. 引擎 schema

每个引擎声明 `preset`、`category`、`layer`、`alpha`、`loop`、`complete`，以及：

- `styles`：该引擎可选的动效风格。文字引擎的 style 对应 `T01 / T03 / T06`，每个 style 自带 `code`、`durationFrames`、`beatRoles` 和专属参数。
- `shared`：所有 style 共用的参数（调色板、对齐、字号等）。

参数描述字段：

| 字段 | 用途 |
|---|---|
| `type` | `string` / `number` / `enum` / `boolean` / `stringList` / `numberList` |
| `label` | 工作台显示的中文名 |
| `default` | 默认值 |
| `min` / `max` / `step` | 数值范围 |
| `values` | enum 可选值 |
| `multiline` | 多行文本 |
| `help` | 参数说明 |

## 3. 创意工程与变体

`creative.json`：

```json
{
  "version": 1,
  "id": "text-display",
  "name": "文字展示",
  "intent": "在实拍上叠一句短文案。",
  "engine": "text",
  "status": "active",
  "appliesTo": { "beatRoles": ["hook", "proof"] },
  "params": { "palette": "aurora" },
  "content": { "copy": ["连接，从这里开始"] }
}
```

`variants/<id>.json`：

```json
{
  "id": "char-rise",
  "name": "逐字上浮",
  "style": "char-rise",
  "status": "draft",
  "beatRoles": ["hook", "proof", "close"],
  "items": [
    { "id": "a", "params": { "text": "连接，从这里开始" } },
    { "id": "b", "params": { "text": "跨区域实时互联", "palette": "ember" } }
  ]
}
```

参数解析顺序：schema 默认值 → `creative.params` → 变体 `params` → item `params`。未知参数、越界值、未知 style 会在校验时报错。

## 4. 出处

每条 catalog 条目带：`creativeId`、`variantId`、`creativeVersion`、`variantVersion`、`style`、`engine`、`preset`、`paramsHash`。素材 ID 为 `<creativeId>-<variantId>-v<index>-<hash>`。

- 参数一变，ID 就变；同一变体的旧 ID 会被标为 `retired`，文件保留。
- `data/props/<id>.*.json` 同时写入 `creative` 块，供 `reindex` 恢复出处。
- 没有出处的生成素材不能保持 `approved`。

## 5. 命令

```bash
node run.mjs creative scan
node run.mjs creative validate --strict
node run.mjs creative plan --creative text-display
node run.mjs creative build --creative text-display --dry-run
node run.mjs creative build --creative text-display --force
node run.mjs creative build --creative text-display --variant char-rise --item a
node run.mjs creative preview --creative text-display --variant char-rise
node run.mjs creative preview --creative text-display --variant char-rise --item a --frame 36
node run.mjs creative review --creative text-display --status approved
node run.mjs creative share all-work:work-20261130-1
node run.mjs creative clean-work work-20261130-1
node run.mjs creative list-works
node run.mjs creative reset --apply --force
```

`build` 会写 props、渲染 MP4 + 透明 WebM + 静帧、自动质量分析、对账 catalog。
`preview` 只出静帧到 `out/creatives/`，不改 catalog。

构建范围逐级收窄：

- 不带 `--creative`：全部工程；
- `--creative`：一个工程；
- `--variant`：一个变体；
- `--item <id|序号>`：该变体下的一条 item。

**缓存与版本语义**

- 素材 ID 由创意 / 变体 / item / props hash / 版本决定；参数和版本都没变时，文件存在即缓存命中：不重渲、不覆盖、不新增，审批与质量数据保留。
- 参数或 item 内容变化 → 变体版本 +1 → 新 ID，作为新素材插入；同一变体、同一 item 的旧 ID 标 `retired`，文件保留。
- `--force` → 同 ID 重渲，MP4/WebM/静帧被覆盖，质量数据作废重算；catalog 条目沿用原审批状态。
- 只构建一个 item 时，只对账该 item 的旧版本，同变体其他 items 不受影响。
- 工作台保存只在 `style / params / items / durationFrames / loop` 变化时升版；只改状态或名称不会升版，也不会制造新素材。

## 6. 工作台

`npm run workbench` → `http://127.0.0.1:4317/#/creative`：

- 按工程与变体浏览；
- 参数控件由引擎 schema 生成；
- 文案逐条编辑，可增删 items；
- 保存、预览静帧、构建、批准/退役；
- 显示构建版本与参数是否已变化。

## 7. 部署与空核心

`creative/` 是内容包，**不进仓库**。核心仓库 clone 后：

```bash
npm ci                    # postinstall 生成空 creative/registry.ts
npm run assets:check      # 无清单时打印“无内容包”并退出 0
node run.mjs sync --check # 注册表 + 素材差异检查，空核心通过
node run.mjs creative scan   # 0 引擎 / 0 工程
```

没有创意包时，核心可以 typecheck、check、扫描实拍和混剪，但 `creative build` 没有可编译对象，也不应该渲染任何生成素材。这是正确状态，不是缺依赖。

部署创意包后：

```bash
# 把创意包放到 creative/（engine.json / index.tsx / creative.json / variants / shared）
node run.mjs sync --apply     # 写注册表 + 登记新素材
node run.mjs creative build
```

`tools/init-creative.mjs` 只在注册表缺失时生成；已有注册表不会被覆盖。强制重写用 `npm run creative:init -- --force`。

## 8. 当前工程

引擎分布：`text`、`transition`、`particle`、`icon-glitch`、`camera` 跟随各自创意工程放在本地 `engine/`；`platform-orbit`、`social-constellation`、`network-universe`、`kinetic-grid`、`icon-morph`、`ui-mock` 因被 camera 复用而放在 `creative/engines/`。`presets.json` 与旧 `registry.ts` 已删除，引擎注册表只有 `creative/registry.ts` 一份。

| 工程 | 引擎 | 变体 | 素材 |
|---|---|---|---|
| `text-display` | text | char-rise / typewriter / keyword | 7 |
| `transitions` | transition | flash / wipe / glitch / light-leak | 8 |
| `particles` | particle | dust / orbs | 4 |
| `camera-moves` | camera | push / shake / zoom / pull | 8 |
| `icon-neon` | icon-glitch | neon / neon-global | 14 |
| `scene-orbit` | platform-orbit | orbit | 2 |
| `scene-constellation` | social-constellation | constellation | 2 |
| `scene-network` | network-universe | network | 2 |
| `scene-grid` | kinetic-grid | grid | 2 |
| `icon-morph` | icon-morph | morph | 2 |
| `ui-mock` | ui-mock | sms / call / account / gate | 4 |

## 9. 边界

- 动画实现仍然在 React 里；创意数据不能凭空生成新的运动。
- 新增参数必须先改组件，再更新引擎 schema。
- 不要手改 `data/catalog.json`；用 `creative build` 或工作台。
