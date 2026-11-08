# DECISIONS

影响架构或流程的选择。新决策追加，不删除旧记录；被推翻时标注 superseded。

## ADR-001 · 独立工作区 + vendored common 快照

- 背景：需要脱离上游 Remotion 工作区独立运行，新会话可直接开始。
- 选项：运行时引用上游 `common/`；或复制快照。
- 结论：复制 `common/{engine,components,vendor,assets,shots}` 到本工作区，保持原目录关系。
- 代价：上游更新需整目录替换并重新验证；换来自包含、可离线、可单独提交。

## ADR-002 · public 用目录链接，不拷贝素材

- 背景：实拍素材在外部目录，生成素材与缩略图在运行时目录。
- 选项：把素材复制进 `public/`；或用链接。
- 结论：`public/assets` 指向 `common/assets`，`public/generated` 指向 `out/assets`，`public/footage` 下每个 root 一个 junction，`public/thumbs` 指向 `data/thumbs`。
- 代价：Windows 需要 junction（无需管理员）；链接冲突时拒绝覆盖，保护用户数据。

## ADR-003 · MP4 与透明 WebM 分开 props

- 背景：同一 preset 既要出实底 MP4，又要出透明 WebM。
- 选项：一份 props 用 `alpha` 分支；或两份 props。
- 结论：每个素材生成 `propsMp4File`（`alpha:false`）与 `propsWebmFile`（`alpha:true`）。
- 代价：多一份 JSON；换来实底与透明两条链路互不污染。

## ADR-004 · 视觉签名 + 源区间双重去重

- 背景：同素材要出多条不重复的成片。
- 选项：只限制素材不复用；或只限制源区间；或两者都限制。
- 结论：
  - 同一成片内：源区间不重叠、相邻不重复、签名唯一；
  - 跨成片：`signatures.json` 记录签名与区间；
  - 签名 = 素材 + 区间 + 裁切/缩放/运动/速度/调色/叠加的哈希。
- 代价：素材少时会降级并标 `relaxed`；换来可验证的「同素材不同画面」。

## ADR-005 · 带 crop 的素材锁定裁剪中心，禁用 pan

- 背景：横屏录屏左右有黑边，随机焦点会把黑边带进 9:16。
- 选项：给素材做代理；或在渲染时用 `object-position` 对准 crop；或完全禁用这类素材。
- 结论：`focusFor()` 对 `crop` 素材使用裁剪中心；运动限制为 push/pull/still。
- 代价：这类素材的构图变化少一些；换来画面干净。
- 后续：素材量大时可加「代理转码」选项，把 crop 烘进 proxy。

## ADR-006 · 默认静音

- 背景：混剪需要音频，但音乐许可/风格因项目而异。
- 结论：`mix.music` 默认 `null`；需要时在配置里指定，并保留 CC BY 署名。
- 代价：默认成片无声；避免默认带入不合适的音乐或漏署名。

## ADR-007 · 生成片段是示意，不冒充实拍

- 背景：品牌图标、UI mock、互联动画都是生成内容。
- 结论：生成片段可叠加、可全屏，但不冒充实拍；手机 UI 等标「示意」；品牌图标不表示合作。
- 代价：画面多一个「示意」标记；避免误导和平台风险。

## ADR-008 · 本地 Remotion 入口 + calculateMetadata

- 背景：素材数量与时长由目录决定，Composition 不能写死。
- 结论：`src/index.ts` 注册 `PipelineAsset` 与 `MixVideo`；用 `calculateMetadata` 从 props 读取 `durationInFrames/fps/width/height`；渲染传 `--props=<json>`。
- 代价：每次渲染多一个 props 文件；换来一批素材共用一套 composition。

## ADR-009 · 局部生成时合并目录

- 背景：`generate --only` 只重渲一个 preset。
- 结论：合并旧 `catalog.json`，保留不在本次 presets 内的条目；同一 preset 的旧条目由新结果替换。
- 代价：要彻底清理旧条目时需手动删 `data/catalog.json`；避免误删其它 preset。

## ADR-010 · 来源不上屏

- 背景：素材来源、平台声明、出处角标会破坏画面，也容易与素材不一致。
- 结论：来源只进 `CREDITS.md`；画面不印出处、不印内部标签、不印分镜描述词。
- 代价：合规信息不在画面里；发布时由账号说明/描述承担。
