# MARKET · 资源市场目录与导入

市场是**资源页的一部分**（本地资源 / 在线市场两种模式），也是**只读目录层**：提供元数据与下载地址，不携带内容，不替代 `assets add`。核心仓库不提交任何市场二进制。

## 1. Provider

核心只保留**中性默认值**：`config/pipeline.json` 的 `market.defaults`（缓存时长、搜索条数、分页条数）。**来源定义与推荐模板不入核心默认值**：

- 推荐来源模板：`config/local.example.json` 的 `market.providers`，内含 Iconify 与 Google Fonts 两条可直接使用的条目。
- 实际来源：`config/local.json` 的 `market.providers`（gitignore，不提交）。复制需要的条目，不用的删掉；`providers` 为空时市场不可用，本地资源管理不受影响。

`config/pipeline.json`（核心默认值）：

```json
{
  "market": {
    "defaults": {
      "cacheHours": 24,
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
        "searchPlaceholder": "搜索图标，例如 arrow right"
      },
      "google-fonts": {
        "type": "google-fonts",
        "label": "Google Fonts",
        "kind": "font",
        "baseUrl": "https://fonts.googleapis.com",
        "catalogUrl": "https://api.fontsource.org/v1/fonts",
        "subset": "latin",
        "cacheHours": 24,
        "enabled": true,
        "searchPlaceholder": "搜索字体，例如 Inter"
      }
    }
  }
}
```

```bash
node tools/market.mjs providers list
node tools/market.mjs providers add iconify-2 --type iconify --base-url https://api.iconify.design
node tools/market.mjs providers add google-2 --type google-fonts --base-url https://fonts.googleapis.com --catalog-url https://api.fontsource.org/v1/fonts --subset latin
node tools/market.mjs providers set google-2 --enabled false
node tools/market.mjs providers remove google-2
```

- `type` 只有 `iconify`（图标）与 `google-fonts`（字体）两种；`type` 与 `baseUrl` 必填，`google-fonts` 还必须有 `catalogUrl`。
- `providers` 的增删改写入 `config/local.json`，核心仓库不保存具体来源内容；工作台“添加来源”从 `config/local.example.json` 读取模板预填，用户可改。
- 网络请求带 20s 超时；失败只影响市场搜索，不影响本地资源管理。
- **缓存与更新**：图标集清单、集合详情、字体目录都缓存在 `data/market/`；`cacheHours` 只决定“多久检查一次”（图标源默认 168h，字体源默认 24h）。过期后带 `If-None-Match` / `If-Modified-Since` 做条件请求，304 只更新时间戳、保留内容；网络失败沿用旧缓存，不让市场整体不可用。
- **图标预览本地缓存**：工作台用 `/media/market/icon` 取图。图标数据按集合用 `GET {baseUrl}/{prefix}.json?icons=a,b,c` **批量**取回（不再逐张请求 SVG 端点，后者容易被 429 限流），缓存在 `data/market/icon-bodies/<provider>/<prefix>.json`，按图标生成的 SVG 落在 `data/market/icons/<provider>/<prefix>/<name>.svg`；集合与目录接口返回后会后台预取当前页图标。未命中时最多等 600ms，超过先返回 1×1 占位 SVG（200，`X-Market-Pending`）让浏览器释放连接；前端滚到可见位才请求，遇到占位或失败按 2s / 6s / 15s 重试，仍失败则隐藏该缩略图。
- **市场入口是类别 + 搜索**：类别与数量由来源自己的目录数据生成，不写进配置；不配置推荐集或快捷词。新来源接入后自动获得同一套类别浏览。
- 样张点击只打开预览；导入必须显式点击，显示目标路径与“已导入”状态。
- provider 的 API key 放 `config/local.json`，不提交。

### Iconify

- 搜索：`GET {baseUrl}/search?query=...&limit=...`。
- 图标集许可/作者：`GET {baseUrl}/collections`，缓存在 `data/market/<provider>.collections.json`，默认 24 小时。
- 目录浏览：从集合缓存按类别（`UI 24px`、`Logos`、`Emoji` 等，类别与数量来自集合元数据）或名称筛选列出图标集，分页；点开图标集沿用原有的集合浏览/集合内搜索。
- 图标数据：`GET {baseUrl}/{prefix}.json?icons=a,b,c` 一次取多个图标 body，本地拼成 SVG 供预览/列表使用；导入仍用 `{baseUrl}/{prefix}/{name}.svg` 直链写清单。
- 可指向自建 Iconify API。

### Google Fonts

- 目录（搜索/字族/许可）：`catalogUrl` 返回 JSON 数组（`id/family/weights/styles/subsets/license/category`），缓存在 `data/market/<provider>.font-catalog.json`，默认 24 小时。
- 默认 `catalogUrl` 用 Fontsource 目录镜像：部分网络下 `fonts.google.com` 与 `www.googleapis.com` 不可达，而 `fonts.googleapis.com` / `fonts.gstatic.com` 可用。要改用官方目录接口，改 `catalogUrl` 即可，代码不做自动切换。
- 字体文件：导入时按字族 + 字重请求 `GET {baseUrl}/css2?family=...:wght@<weight>&display=swap`（带浏览器 UA），从返回的 `@font-face` 中取 `subset`（默认 `latin`，可用 provider 的 `subset` 改）对应的 `woff2` 直链。
- 许可取自目录记录的 `license`（如 `OFL-1.1`），不猜测；发布时该字段会进入 `shared/CREDITS.md`。
- 目录浏览：按类别（`sans-serif` / `display` / `serif` / `handwriting` / `monospace` 等，类别与数量来自目录缓存）或关键词列出字族，分页加载；可再展开字族查看全部字重与斜体。
- 预览：条目 `preview` 是 CSS2 地址，工作台注入 `<link>` 后用该字族渲染样张，不下载文件；列表页按视口懒加载样式，只拉可见样张。

## 2. Catalog 条目

图标：

```json
{
  "id": "lucide:arrow-right",
  "provider": "iconify",
  "kind": "icon",
  "dir": "icons",
  "name": "arrow-right",
  "prefix": "lucide",
  "collection": "Lucide",
  "license": "ISC",
  "licenseUrl": "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
  "source": "Iconify / Lucide",
  "author": "Lucide Contributors",
  "url": "https://api.iconify.design/lucide/arrow-right.svg",
  "preview": "https://api.iconify.design/lucide/arrow-right.svg",
  "fileName": "lucide-arrow-right.svg",
  "providerRef": "lucide"
}
```

字体：

```json
{
  "id": "inter:700",
  "provider": "google-fonts",
  "kind": "font",
  "dir": "fonts",
  "name": "Inter",
  "family": "Inter",
  "weight": 700,
  "style": "normal",
  "collection": "Inter",
  "license": "OFL-1.1",
  "licenseUrl": null,
  "source": "Google Fonts / Inter",
  "url": null,
  "preview": "https://fonts.googleapis.com/css2?family=Inter%3Awght%40700&display=swap",
  "fileName": "inter-700.woff2",
  "subset": "latin"
}
```

- `dir` 决定入库目录（`icons/` / `fonts/`），`fileName` 决定清单路径与去重键。
- 字体的 `url` 在导入时解析后才有值（`resolve` 阶段）；导入与“已导入”判断都用 `dir + fileName`。
- 字体 id 为 `family-id:weight[-italic]`；图标 id 为 `prefix:name`。

## 3. 导入流程

1. 搜索返回 catalog 条目；用户点击导入。
2. 服务端按 id 重新解析条目（图标按 `prefix:name`，字体按字族 + 字重取 CSS2 直链），不信任客户端 URL。
3. 调用现有 `assets add <url> --kind <icons|fonts> --name <fileName> --license <license> --source <source> --provider <id> --ref <providerRef>`；字体再加 `--family / --weight [--style italic]`。
4. `assets add` 下载、计算哈希、写入 `shared/assets.manifest.json`，并自动更新 `shared/fonts.ts`（字体）与 `shared/CREDITS.md`。
5. 已存在且无 `--force` 时跳过（`fonts/<fileName>` 或 `icons/<fileName>` 已在清单里），不会重复登记。

命令：

```bash
node tools/market.mjs search "arrow right" [--provider id] [--limit 24] [--json]
node tools/market.mjs browse [--provider id] [--category sans-serif] [--q text] [--offset N] [--limit N] [--json]
node tools/market.mjs import lucide:arrow-right [--provider id] [--force]
node tools/market.mjs import inter:700 [--provider google-fonts] [--force]
```

工作台（资源页 → 在线市场）：

- `GET /api/market/providers`：来源、默认值、来源模板
- `POST /api/market/providers`：`add / set / remove`，入队 `market.mjs providers`
- `GET /api/market/search?provider=id&q=...&limit=24`
- `GET /api/market/browse?provider=id&category=...&q=...&offset=...&limit=...`：类别、总数与按类别浏览图标集（图标源）或字族（字体源）
- `GET /api/market/collection?provider=id&prefix=...&q=...&offset=...&limit=...`（图标集或字族变体）
- `POST /api/market/import { "icon": "lucide:arrow-right" | "inter:700", "provider": "iconify" }`

搜索与浏览互不覆盖：搜索结果头部有“返回目录”，类别浏览、图标集/字族浏览各自保留返回路径。

## 4. 安全与许可

- 下载内容按不可信输入处理：不执行、不自动打开；预览通过 `<img>` / 静态文件 / CSS 样张。
- 许可来自 provider 的目录元数据；导入时写入清单，`shared credits` 会带进 CREDITS。
- 许可无法确认的条目不要导入；市场不猜测许可。
- Google Fonts 默认只取 `latin` 子集；中文正文仍用本地字体。可变字体在多个字重下可能返回同一份文件，按字重各登记一条。

## 5. Lock 与复现

**清单即锁**：`shared/assets.manifest.json` 每条记录 `path / size / sha256 / url / license / source`，市场导入再补 `provider` 与 `providerRef`（图标为图标集前缀，字体为 gstatic 版本段，如 `v16`）。不另建 lock 文件，避免第二真相源。

- `assets fetch` 下载后按清单 `sha256` 校验；不符则不落盘、计入失败。
- `assets check --verify` 校验磁盘文件与清单哈希一致。
- 换机（在线）：拿到内容包的 `shared/`（清单）→ `npm run assets:fetch` → `node tools/assets.mjs check --verify --strict`。
- 断网：`npm run assets:fetch -- --from <U盘或内网目录>` 按 `path` 复制 → `check --verify`；清单里的 `url` 完全不被访问。
- 只有清单、无网络无副本时无法复现二进制——素材二进制不入库，任何方案都如此。
- 市场来源定义在 `config/local.json`，换机后可重新添加；复现不依赖它，因为 `url + sha256` 已在清单里。

## 6. 未做

- 图片/音效/视频 provider。
- 市场服务端、团队私有源。
