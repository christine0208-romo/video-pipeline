# CREDITS

本工作区使用的第三方素材与代码。新增素材必须同时更新这里与 `common/assets/REGISTRY.json`。

## 品牌图标

- 来源：Simple Icons — https://simpleicons.org
- 许可：CC0 1.0；品牌标识归各平台所有
- 文件：`common/assets/icons/{whatsapp,facebook,instagram,telegram,x-twitter,youtube,tiktok,wechat,discord,line,threads,snapchat,pinterest,spotify}.svg` 等
- 说明：仅作类别示意，不表示合作或背书。

## 通用图标

- 来源：Lucide — https://lucide.dev
- 许可：ISC
- 使用方式：`lucide-react` 包内图标（短信、电话、盾牌、用户、信号等）。

## 字体

- Noto Sans SC（Google Fonts / Noto CJK）— SIL OFL 1.1
- Inter — SIL OFL 1.1
- JetBrains Mono — SIL OFL 1.1
- ZCOOL KuaiLe — SIL OFL 1.1
- Ma Shan Zheng — SIL OFL 1.1
- 文件：`common/assets/fonts/`
- 字体清单与 public 路径：`common/engine/fonts.ts`

## 世界地图

- `common/assets/map/world-dots.json`
- 许可：Public Domain

## 音乐

- `common/assets/music/Crypto.mp3`、`common/assets/music/Floating-Cities.mp3`
- 作者：Kevin MacLeod（incompetech.com）
- 许可：CC BY 4.0
- 署名见 `common/assets/music/LICENSES.md`
- 默认混剪未启用音乐；启用时必须在成片说明或发布信息中保留署名。

## 镜头卡

- 来源：video-shotcraft
- 许可：Apache 2.0
- 文件：`common/shots/`
- 许可与署名：`common/shots/LICENSE`、`common/shots/ATTRIBUTION.md`
- 说明：镜头卡是方法文档，参数按横屏标定；竖屏需按 1080×1920 重标。

## 动效与 Canvas 实现

- `common/vendor/fy-implementations/`：来自 fy-code-animation
  - 许可：见 `common/vendor/fy-LICENSE.md` 与 `common/vendor/fy-LICENSES/`
  - 免费分享，不得付费转售或重新打包收费。
- `common/vendor/canvas-engine/`：本工作区自写（claude_04），随本工作区使用。
- `common/components/reel/`：本工作区自写，随本工作区使用。

## 框架

- Remotion 4.0.539 — Remotion License（个人与 ≤3 人公司免费，更大组织需购买）
- React / React DOM 19.2.3 — MIT
- Lucide React 1.69.0 — ISC
- TypeScript 5.9.3 — Apache-2.0
- ffmpeg / ffprobe — 系统安装，不随工作区分发；许可取决于本机构建。

## 生成素材

- 由本工作区 `modules/generate` 与 `src/generated` 生成。
- 属于示意素材，不冒充实拍，不表示平台合作或背书。
