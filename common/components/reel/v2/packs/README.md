# Style Pack 开发约定

每个 pack 是一个**独立导演方案**，不是一套换色参数。三条片子之所以不同，靠的是 pack 之间的版式、运动语言、字体和文字布局都不同。

## 一个 pack 必须提供

```ts
export const YourPack: React.FC<PackRendererProps> = ({ beat, edl }) => {
  // beat.role: "hook" | "body" | "end"
  // beat.props: 该 pack 自己的字段
  // beat.media: 单媒体 pack 的 evidence（可选）
  // beat.dur / beat.at: 本拍时长与起点
};
```

- 自己的 hook / body / end 布局。
- 自己的字体组合、配色、字号阶。
- 自己的入场、镜头运动、转场语法。
- 自己的 props schema；不能要求别的 pack 的字段。
- 证据规则：实拍 id 或 UI 示意；不能按关键词猜。

## 禁止

- 复制另一个 pack 的版式再换色。
- 与另一个 pack 共用“页签 + 左侧媒体 + 右侧文字”这种骨架。
- 把三栏/优缺点同时塞满一屏。
- 用 `证据 / 开场 / 结论` 这类内部标签上屏。
- 用绝对化措辞。

## 注册步骤

1. `v2/packs/<your-pack>.tsx`：实现组件。
2. `v2/types.ts`：`PackId` 增加 id。
3. `v2/packs/registry.json`：登记元数据（name / description / narratives / requiredEvidence / avoid）。
4. `v2/packs/registry.ts`：`RENDERERS` 增加映射。
5. `common/docs/SYSTEM.md` 与 `common/prompts/batch-script.md`：补 props schema 示例。
6. `npm run typecheck`、`npm run check`；新 pack 涉及新素材时更新 `CREDITS`。

## 现有 pack

| id | 版式骨架 | 运动语言 | 字体 |
|---|---|---|---|
| `horizontal-table` | 三张卡横排在桌面，镜头平移 | 横移、卡片抬起、纸张阴影 | Noto Sans SC + JetBrains Mono |
| `split-debate` | 左右两半同屏，中间 VS | 左右滑入、比分/ON AIR、硬切 | Noto Sans SC Black + Inter |
| `field-notes` | 实拍全屏 + 手写核查单 | 手持推近、勾选描线、印章砸下 | Ma Shan Zheng + Noto Sans SC |
| `icon-journey` | 平台图标徽章 + 证据卡逐拍推进 | 图标缩小归位、证据卡上浮、叉/勾印章 | Noto Sans SC + JetBrains Mono |
| `clip-remix` | 全屏片段快切 + 叠加层 | 硬切、甩镜、推拉、闪白；实拍与生成片段同一时间线 | Noto Sans SC + JetBrains Mono |

## 证据与 UI

- `mediaAsset`：素材库/批次里的真实片段或图片 id。
- `mediaUi`：`sms` / `region`，由 `v2/media.tsx` 绘制，必须标「示意」。
- 有自带文字的素材不要让新贴片压上去。
- 证据句用 `assetId` 锁死素材；不要靠标签自动选。

## 自检

- 和另外两个 pack 相比，版式、运动、字体至少两项不同。
- hook 和 end 也不是同一个骨架。
- 一屏只讲一个观点；文字在安全区内。
- 静帧一眼能看出这是哪一套语法，而不是“同一模板换色”。
