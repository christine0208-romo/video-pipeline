/**
 * 内容里的素材路径统一规范成 public 下的 assets/... URL。
 * 支持相对路径（icons/x.svg）、assets/ 前缀、绝对 URL 与 data: URL；
 * `creative/...`（工程自带素材，编译时已解析）原样保留。
 */
export function assetPath(value: string): string {
  const clean = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean) return clean;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("/")) return clean;
  if (clean.startsWith("assets/") || clean.startsWith("creative/")) return clean;
  return `assets/${clean}`;
}
