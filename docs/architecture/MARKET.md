# MARKET · 资源市场目录与导入

市场是**资源页的一部分**（本地资源 / 在线市场两种模式），也是**只读目录层**：提供元数据与下载地址，不携带内容，不替代 `assets add`。核心仓库不提交任何市场二进制。

## 1. Provider

核心只保留默认值（`config/pipeline.json` 的 `market.defaults`），**来源定义在本地配置** `config/local.json` 的 `market.providers`，不提交仓库。工作台与 CLI 通过命令维护：

`config/pipeline.json`（核心默认值）：

```json
{
  "market": {
    "defaults": {
      "type": "iconify",
      "kind": "icon",
      "baseUrl": "https://api.iconify.design",
      "cacheHours": 24,
      "searchPlaceholder": "搜索图标",
      "searchLimit": 24,
      "collectionLimit": 120
    }
  }
}
```

`config/local.json`（本地内容，不提交）：

```json
{
  "market": {
    "providers": {
      "iconify": {
        "type": "iconify",
        "label": "Iconify",
        "kind": "icon",
        "baseUrl": "https://api.iconify.design",
        "cacheHours": 24,
        "enabled": true,
        "searchPlaceholder": "搜索图标，例如 arrow right",
        "suggestions": ["arrow", "phone", "chart"],
        "featured": ["lucide", "material-symbols", "tabler"]
      }
    }
  }
}
```

```bash
node tools/market.mjs providers list
node tools/market.mjs providers add iconify-2 --type iconify --label "Iconify 2" --base-url https://api.iconify.design --featured lucide,tabler --suggestions arrow,phone
node tools/market.mjs providers set iconify-2 --enabled false
node tools/market.mjs providers remove iconify-2
```

- `type` 目前只有 `iconify`（可指向自建 Iconify API）。
- `providers` 的增删改写入 `config/local.json`，核心仓库不保存具体来源内容；默认值在 `config/pipeline.json` 的 `market.defaults`。
- Iconify 搜索：`GET /search?query=...&limit=...`。
- 图标集许可/作者：`GET /collections`，缓存在 `data/market/<provider>.collections.json`，默认 24 小时。
- 网络请求带 20s 超时；失败只影响市场搜索，不影响本地资源管理。
- 推荐区按 provider 的 `featured` 图标集展示样张；快捷搜索词来自 `suggestions`；搜索占位符来自 `searchPlaceholder`。全部来自配置，不在代码里写死。
- 样张点击只打开预览；导入必须显式点击，显示目标路径 `assets/icons/<file>`，已存在的条目显示“已导入”并允许覆盖。
- 未来 provider 的 API key 放 `config/local.json`，不提交。

## 2. Catalog 条目

```json
{
  "id": "lucide:arrow-right",
  "provider": "iconify",
  "kind": "icon",
  "name": "arrow-right",
  "prefix": "lucide",
  "collection": "Lucide",
  "license": "ISC",
  "licenseUrl": "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
  "source": "Iconify / Lucide",
  "author": "Lucide Contributors",
  "url": "https://api.iconify.design/lucide/arrow-right.svg",
  "preview": "https://api.iconify.design/lucide/arrow-right.svg",
  "fileName": "lucide-arrow-right.svg"
}
```

## 3. 导入流程

1. 搜索返回 catalog 条目；用户点击导入。
2. 服务端按 `prefix:name` 重新解析条目，不信任客户端 URL。
3. 调用现有 `assets add <url> --kind icons --name <prefix>-<name>.svg --license <license> --source <source>`。
4. `assets add` 下载、计算哈希、写入 `shared/assets.manifest.json`，并自动更新 `shared/fonts.ts`（字体）与 `shared/CREDITS.md`。
5. 已存在且无 `--force` 时跳过。

命令：

```bash
node tools/market.mjs search "arrow right" [--limit 24] [--json]
node tools/market.mjs import lucide:arrow-right [--force]
```

工作台（资源页 → 在线市场）：

- `GET /api/market/providers`
- `POST /api/market/providers`：`add / set / remove`，入队 `market.mjs providers`
- `GET /api/market/search?provider=id&q=...&limit=24`
- `GET /api/market/featured?provider=id`
- `GET /api/market/collection?provider=id&prefix=...&q=...&offset=...&limit=...`（浏览整图标集，支持集合内搜索与分页）
- `POST /api/market/import { "icon": "lucide:arrow-right", "provider": "iconify" }`

## 4. 安全与许可

- 下载内容按不可信输入处理：不执行、不自动打开；预览通过 `<img>` / 静态文件。
- 许可来自 provider 的图标集元数据；导入时写入清单，`shared credits` 会带进 CREDITS。
- 许可无法确认的条目不要导入；市场不猜测许可。
- 当前只支持 Iconify 图标；字体、音效、图片、视频 provider 与服务端目录后续再做。

## 5. 未做

- Google Fonts provider。
- 图片/音效/视频 provider。
- 市场服务端、团队私有源与 lock 文件；清单里的 `url + sha256 + source` 已是当前导入记录。
