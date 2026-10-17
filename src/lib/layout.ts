import type { PagePlacement, ScalePercent } from "./types";

export interface Margins {
  x: number;
  y: number;
  gap: number;
}

const clamp = (min: number, v: number, max: number) => Math.min(Math.max(v, min), max);

/** 第11.2節の CSS 変数と同じ値を JS で求める（唯一の計算元。CSS 変数はこの値から設定する）。 */
export function marginsFor(viewportWidth: number, viewportHeight: number): Margins {
  return {
    y: clamp(8, viewportHeight * 0.011, 24),
    x: clamp(8, viewportWidth * 0.011, 24),
    gap: clamp(4, viewportWidth * 0.004, 12),
  };
}

/**
 * 第11.3節：fitSize の計算。
 * 縦幅いっぱいにし、横幅が足りない場合だけ縮小する。戻り値はフィット時のページ表示高さ。
 */
export function fitPageHeight(
  workspace: { width: number; height: number },
  ratios: readonly [number, number],
  margins: Margins,
): number {
  const availableWidth = workspace.width - 2 * margins.x;
  const availableHeight = workspace.height - 2 * margins.y;
  const ratioSum = ratios[0] + ratios[1];
  if (availableWidth <= 0 || availableHeight <= 0 || ratioSum <= 0) return 0;
  let h = availableHeight;
  const spreadWidth = h * ratioSum + margins.gap;
  if (spreadWidth > availableWidth) h = (availableWidth - margins.gap) / ratioSum;
  return Math.max(h, 0);
}

export interface SpreadLayout {
  pageHeight: number;
  leftWidth: number;
  rightWidth: number;
  gap: number;
}

/** 第11A節：倍率はフィット高さに掛ける。間隔は倍率で変えない。 */
export function computeSpreadLayout(
  workspace: { width: number; height: number },
  ratios: readonly [number, number],
  margins: Margins,
  scalePercent: ScalePercent,
): SpreadLayout | null {
  const fit = fitPageHeight(workspace, ratios, margins);
  if (fit <= 0) return null;
  const pageHeight = Math.max(1, Math.floor(fit * (scalePercent / 100)));
  return {
    pageHeight,
    leftWidth: Math.max(1, Math.round(pageHeight * ratios[0])),
    rightWidth: Math.max(1, Math.round(pageHeight * ratios[1])),
    gap: margins.gap,
  };
}

export function placementLabel(p: PagePlacement): string {
  return p === "center" ? "中央" : p === "top-left" ? "左上" : "上中央";
}

export function scaleLabel(s: ScalePercent): string {
  return s === 100 ? "フィット" : `${s}％`;
}
