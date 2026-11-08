# LESSONS

只追加，不删除。每条写清：日期 / 现象 / 原因 / 修法 / 预防。新会话先读一遍再动手。

## 模板

```md
## YYYY-MM-DD · 一句话标题

- 现象：
- 原因：
- 修法：
- 预防：
```

## 2026-11-08 · 透明 WebM 的 ffprobe 显示 yuv420p，但 alpha 是正常的

- 现象：用 `--codec=vp9 --pixel-format=yuva420p` 渲染出来的 WebM，`ffprobe` 显示 `pix_fmt=yuv420p`，看起来像没有 alpha。
- 原因：VP9 把 alpha 存在额外块里，主流 `ffprobe` 只报主流的 yuv420p；文件元数据里有 `ALPHA_MODE=1`。
- 修法：用 libvpx 解码验证：
  ```bash
  ffmpeg -c:v libvpx-vp9 -i out.webm -vf alphaextract -frames:v 1 alpha.png
  ```
  alpha 图有黑有白即正常。或在 Remotion 里直接叠加看效果。
- 预防：不要只看 `pix_fmt`；同时看 `ALPHA_MODE` 和 alphaextract 结果。

## 2026-11-08 · 白色品牌图标在白底上消失

- 现象：Facebook / Instagram / TikTok 的 SVG 是 `fill="#FFFFFF"`，放在白色圆角块上不可见。
- 原因：Simple Icons 默认白色，深色底设计；我们用了白色 tile。
- 修法：`src/generated/parts.tsx` 里对 `WHITE_ICONS` 加 `filter: invert(1)`；图标清单在 `src/generated/assets.json`。
- 预防：新增品牌图标先看 SVG 根节点 `fill`，白色图标加入 `whiteIcons`。

## 2026-11-08 · 横屏素材随机焦点把黑边带进画面

- 现象：1920×1080 的录屏左右有黑边，混剪后画面右侧出现一条黑带。
- 原因：素材有 `crop` 元数据（有效画面 612×1080），但 planner 随机选 `focus`，`object-fit: cover` 把黑边也带进来。
- 修法：`focusFor(asset, rnd)` 对带 `crop` 的素材锁定裁剪中心；并且只允许 push/pull/still，禁止 pan，避免平移露出黑边。
- 预防：新增素材后看 `library.json` 的 `crop`；带 crop 的素材不要用自由焦点。

## 2026-11-08 · MP4 和透明 WebM 不能共用同一份 props

- 现象：第一次生成时 MP4 用了 `alpha: true` 的 props，实底视频背景变成透明/白。
- 原因：同一份 props 同时服务实底与 alpha，`GeneratedAsset` 根据 `alpha` 决定是否铺底色。
- 修法：catalog 为每个素材写 `propsMp4File`（`alpha: false`）与 `propsWebmFile`（`alpha: true`），渲染时分别使用。
- 预防：任何「同一画面、两种透明模式」的渲染，都拆 props。

## 2026-11-08 · 生成素材时长要可变，Composition 不能写死

- 现象：不同素材需要不同 `durationInFrames`，但 Root 里 `<Composition>` 的时长是静态的。
- 原因：Remotion Composition 的时长在注册时固定。
- 修法：用 `calculateMetadata` 从 props 读取 `durationInFrames`；渲染时传 `--props=<json>`。
- 预防：所有「一批同构图、不同时长」的素材，都用 `calculateMetadata`。

## 2026-11-08 · 重跑同一条 EDL 会和自己已出成片的签名冲突

- 现象：第二次跑 `mix` 时，第一条规划报「与已出成片视觉签名重复」。
- 原因：签名库里已经有上一次同名 output 的签名，规划时没有先移除自己的旧记录。
- 修法：规划前对本次要重出的每个 `mix-<seed>-<n>` 调 `removeOutputFromRegistry`；再 `addToRegistry`。
- 预防：任何「可重跑」的去重注册表，都要先撤销本次输出自己的旧记录。

## 2026-11-08 · `generate --only` 会冲掉其它 preset 的目录

- 现象：只重渲 `network-universe` 时，`catalog.json` 变成只剩 1 条。
- 原因：`buildCatalog` 只按当前 presets 构建，直接覆盖目录。
- 修法：generate 合并旧目录：保留不在本次 presets 内的条目，写回合并结果。
- 预防：局部更新命令必须声明「保留其它条目」。

## 2026-11-08 · 静止展示类素材只有 1 个场景

- 现象：26 条实拍里大部分 scene 检测只有 1 个镜头，看起来像没切分。
- 原因：产品卡片/手机录屏本身是连续单镜，scene 分数达不到阈值（0.32）。
- 修法：接受 1 个场景；混剪靠不同源区间、裁切、缩放、调色制造差异。
- 预防：不要用场景数量衡量素材质量；看 `crop` 和可用时长。

## 2026-11-08 · public 链接冲突要停下，不要覆盖

- 现象：`public/assets` 已存在且指向别处时，`ensurePublicLinks` 抛错。
- 原因：避免误删用户数据。
- 修法：人工检查链接目标，必要时先改名备份，再重跑。
- 预防：不要把 `public/` 提交进 git；它应由运行时重建。

## 2026-11-08 · 中文文件名可以进 staticFile，但不要自己编码

- 现象：`实拍-whatsapp-signup.mp4` 渲染正常，但担心路径编码。
- 原因：Remotion 4 的 `staticFile()` 自己会 `encodeURIComponent`。
- 修法：EDL 里写 `footage/<root>/实拍-....mp4` 原样路径；不要预先编码。
- 预防：看到路径里有 `%20`/`%E5` 说明被重复编码了，改用原始路径。

## 2026-11-08 · 生成片段复用超过 2 次要警告

- 现象：只有 1 个生成素材时，两条成片都用到它，画面重复。
- 原因：目录条目不足。
- 修法：`validateEdl` 对 `registry.generated` 超过 2 次给 warning；生成更多变体。
- 预防：默认至少 6 个 preset × 2 组变体；素材少时先补生成素材。

## 2026-11-08 · `ffprobe` 对 WebM 的 duration 可能是 N/A

- 现象：VP9 WebM 的 `duration` 显示 `N/A`。
- 原因：容器未写时长元数据，不影响播放与合成。
- 修法：用 `catalog.json` 里的 `duration` 字段（来自渲染配置），不要依赖 ffprobe 的 WebM duration。
- 预防：所有消费方读目录元数据，不现场 probe 生成素材。

## 2026-11-08 · 静帧用于构图检查，不用于 alpha 验证

- 现象：`renderStill` 出来的 PNG 没有 alpha（rgb24）。
- 原因：静帧不走 `yuva420p` 视频链路；它只用于看构图。
- 修法：alpha 验证用 `alphaextract` 或直接把 WebM 叠到实拍上看。
- 预防：静帧检查构图，视频检查透明与运动。

## 2026-11-08 · 抽离独立工作区时，路径与提示要一起改

- 现象：复制到独立目录后，`scan` 仍提示 `node pipeline/run.mjs generate`，`render.mjs` 仍指向旧仓库 `node_modules`。
- 原因：`REPO_ROOT`、CLI 路径、`cwd`、日志提示都还指向上游。
- 修法：
  - `config.mjs` 的 `REPO_ROOT = PIPELINE_ROOT`；
  - `render.mjs` 的 CLI 用本目录 `node_modules`，`cwd` 用本目录；
  - `run.mjs` 的 `REPO = ROOT`；
  - 全仓搜索 `pipeline/run.mjs` 并改成本地命令。
- 预防：抽离后用 `npm run doctor` + `npm run check` + 一次 `scan` 验证提示和路径。

## 2026-11-08 · public/footage 是目录，不是单个链接

- 现象：`check` 报 `public/footage 不是链接`，但扫描与渲染都正常。
- 原因：`public/footage` 是一个目录，里面每个素材根各有一个 junction；它不是单一链接。
- 修法：`check` / `doctor` 对 `public/footage` 检查「目录 + 子项为链接」，其它 public 目录检查单一链接。
- 预防：新增 public 结构时，先明确它是「单链接」还是「链接容器」。

