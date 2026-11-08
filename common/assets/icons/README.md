# 公共图标库

24×24 单色 SVG，通过 `icon(ctx, name, x, y, size, color)` 调用。

| 文件 | 来源 | 许可 |
|---|---|---|
| facebook / instagram / tiktok / x-twitter / youtube / whatsapp / telegram / discord / reddit / snapchat / line / threads / pinterest / twitch / spotify / wechat / kakao / viber / openai / anthropic / claude | Simple Icons | CC0 1.0（品牌标识归各平台所有） |
| mail / phone / shield / globe / smartphone / tablet / laptop / lock / user / check / x / alert-triangle / message-circle / heart / send / search / repeat / fingerprint / scan-line / circle-x / triangle-alert / music-2 / play / wifi / router / signal / cpu / qr-code / smartphone-nfc / radio-tower | Lucide | ISC |
| sim-card | Material Symbols | Apache 2.0 |

> `x.svg` 是 Lucide 的关闭叉，`x-twitter.svg` 才是 X（原 Twitter）平台标识，不要混用。

## 新增

1. 从 Simple Icons / Lucide / Material Symbols 下载 SVG，放到本目录。
2. 在作品 `src/main.js` 的 `ICON_NAMES` 中登记。
3. 需要署名或特殊许可的，更新本文件与作品 `out/CREDITS.md`。
