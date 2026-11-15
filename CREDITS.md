# CREDITS

核心框架使用的第三方代码与工具链。**创意内容与素材的许可见 `shared/CREDITS.md`**。

## 通用图标

- 来源：Lucide — https://lucide.dev
- 许可：ISC
- 使用方式：`lucide-react` 包内图标（短信、电话、盾牌、用户、信号等）。

## 动效与 Canvas 实现

- `common/engine` 的 `motion-core.mjs`、`time.ts`、`fonts.ts` 源自 fy-code-animation（俯仰观照），上游注明为独立编写
  - 许可：作者免费分享；不得包装成付费课程 / 付费 skills / 收费资料出售
- 其余 `common/engine` 文件为本工作区自写
- Canvas 绘制引擎（项目背景、品牌印章、平台 rail 等）属于内容，见 `shared/CREDITS.md`

## 框架

- Remotion 4.0.539 — Remotion License（个人与 ≤3 人公司免费，更大组织需购买）
- React / React DOM 19.2.3 — MIT
- Lucide React 1.69.0 — ISC
- TypeScript 5.9.3 — Apache-2.0
- ffmpeg / ffprobe — 系统安装，不随工作区分发；许可取决于本机构建。
