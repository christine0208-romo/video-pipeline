import type { FontSpec } from "../vendor/fy-implementations/remotion-kit/fonts";

export { useFonts, measureCN } from "../vendor/fy-implementations/remotion-kit/fonts";
export type { FontSpec };

/**
 * 字体清单：file 相对 public/。public/assets 是指向 common/assets 的目录联接，
 * 所以新增字体只需放进 common/assets/fonts 并在这里登记。
 */
export const FONT_MANIFEST: FontSpec[] = [
  { family: "Noto Sans SC", file: "assets/fonts/NotoSansSC-Regular.otf", weight: "400" },
  { family: "Noto Sans SC", file: "assets/fonts/NotoSansSC-Medium.otf", weight: "500" },
  { family: "Noto Sans SC", file: "assets/fonts/NotoSansSC-Bold.otf", weight: "700" },
  { family: "Noto Sans SC", file: "assets/fonts/NotoSansSC-Black.otf", weight: "900" },
  { family: "Inter", file: "assets/fonts/inter-400.woff2", weight: "400" },
  { family: "Inter", file: "assets/fonts/inter-600.woff2", weight: "600" },
  { family: "JetBrains Mono", file: "assets/fonts/jbmono-400.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "assets/fonts/jbmono-600.woff2", weight: "600" },
  { family: "ZCOOL KuaiLe", file: "assets/fonts/zcool-kuaile-cn.woff2", weight: "400" },
  { family: "Ma Shan Zheng", file: "assets/fonts/ma-shan-zheng-cn.woff2", weight: "400" },
];
