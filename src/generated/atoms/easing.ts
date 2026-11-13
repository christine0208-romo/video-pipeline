import { clamp01 } from "../../platform";

export const easeOutExpo = (p: number): number => {
  const x = clamp01(p);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

export const easeOutQuint = (p: number): number => {
  const x = clamp01(p);
  return 1 - Math.pow(1 - x, 5);
};

export const easeOutBack = (p: number): number => {
  const x = clamp01(p);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
