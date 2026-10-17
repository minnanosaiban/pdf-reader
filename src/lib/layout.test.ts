import { describe, expect, it } from "vitest";
import { computeSpreadLayout, fitPageHeight, marginsFor } from "./layout";

const A4 = 210 / 297;
const margins = { x: 12, y: 12, gap: 8 };

describe("fitPageHeight", () => {
  it("横に余裕があれば縦いっぱいにする", () => {
    const h = fitPageHeight({ width: 1864, height: 1080 }, [A4, A4], margins);
    expect(h).toBeCloseTo(1080 - 24, 5);
  });
  it("横幅が足りないときだけ縮小し、合計幅が利用可能幅に一致する", () => {
    const h = fitPageHeight({ width: 800, height: 1080 }, [A4, A4], margins);
    expect(h * (A4 + A4) + margins.gap).toBeCloseTo(800 - 24, 5);
  });
  it("縦向きと横向きが並んでも高さはそろい、幅は比率で決まる", () => {
    const l = computeSpreadLayout({ width: 1600, height: 900 }, [A4, 1.5], margins, 100)!;
    expect(l.leftWidth / l.pageHeight).toBeCloseTo(A4, 2);
    expect(l.rightWidth / l.pageHeight).toBeCloseTo(1.5, 2);
  });
  it("サイズが0以下なら 0", () => {
    expect(fitPageHeight({ width: 10, height: 10 }, [A4, A4], margins)).toBe(0);
  });
});

describe("computeSpreadLayout", () => {
  it("倍率はフィット高さに掛かり、間隔は変わらない", () => {
    const ws = { width: 1864, height: 1080 };
    const l100 = computeSpreadLayout(ws, [A4, A4], margins, 100)!;
    const l90 = computeSpreadLayout(ws, [A4, A4], margins, 90)!;
    const l80 = computeSpreadLayout(ws, [A4, A4], margins, 80)!;
    expect(l90.pageHeight).toBe(Math.floor(l100.pageHeight * 0.9));
    expect(l80.pageHeight).toBe(Math.floor(l100.pageHeight * 0.8));
    expect(l80.gap).toBe(l100.gap);
    expect(l80.leftWidth / l80.pageHeight).toBeCloseTo(A4, 2);
  });
});

describe("marginsFor", () => {
  it("1920×1080 で上下約12px", () => {
    const m = marginsFor(1920, 1080);
    expect(m.y).toBeCloseTo(11.88, 1);
    expect(m.x).toBeGreaterThanOrEqual(8);
    expect(m.gap).toBeGreaterThanOrEqual(4);
    expect(m.gap).toBeLessThanOrEqual(12);
  });
});
