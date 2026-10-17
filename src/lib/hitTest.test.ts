import { describe, expect, it } from "vitest";
import { hitTestAnnotations } from "./hitTest";
import type { Annotation } from "./types";

const size100 = { width: 700, height: 1000 };
const size80 = { width: 560, height: 800 };

const line: Annotation = {
  id: "line",
  type: "stroke",
  pageNumber: 1,
  tool: "red",
  widthRatio: 0.0026,
  points: [
    { x: 0.1, y: 0.5 },
    { x: 0.9, y: 0.5 },
  ],
};

// 大きな丸で囲んだストローク
const circle: Annotation = {
  id: "circle",
  type: "stroke",
  pageNumber: 1,
  tool: "blue",
  widthRatio: 0.0026,
  points: Array.from({ length: 41 }, (_, i) => {
    const t = (i / 40) * Math.PI * 2;
    return { x: 0.5 + 0.3 * Math.cos(t), y: 0.5 + 0.2 * Math.sin(t) };
  }),
};

const text: Annotation = {
  id: "text",
  type: "text",
  pageNumber: 1,
  x: 0.2,
  y: 0.2,
  w: 0.3,
  h: 0.05,
  text: "memo",
  sizeRatio: 0.028,
};

describe("hitTestAnnotations", () => {
  it("線の上と許容幅内で選択される", () => {
    expect(hitTestAnnotations([line], { x: 0.5, y: 0.5 }, size100)).toBe("line");
    // 許容幅 = 1000*0.0026/2 + 4 ≈ 5.3px → 4px 離れ
    expect(hitTestAnnotations([line], { x: 0.5, y: 0.504 }, size100)).toBe("line");
  });
  it("許容幅の外では選択されない", () => {
    expect(hitTestAnnotations([line], { x: 0.5, y: 0.52 }, size100)).toBeNull();
    expect(hitTestAnnotations([line], { x: 0.95, y: 0.5 }, size100)).toBeNull();
  });
  it("囲み線の内側をクリックしても選択されない", () => {
    expect(hitTestAnnotations([circle], { x: 0.5, y: 0.5 }, size100)).toBeNull();
    expect(hitTestAnnotations([circle], { x: 0.8, y: 0.5 }, size100)).toBe("circle");
  });
  it("テキスト矩形の内外", () => {
    expect(hitTestAnnotations([text], { x: 0.3, y: 0.22 }, size100)).toBe("text");
    expect(hitTestAnnotations([text], { x: 0.6, y: 0.22 }, size100)).toBeNull();
    expect(hitTestAnnotations([text], { x: 0.3, y: 0.3 }, size100)).toBeNull();
  });
  it("重なっているときは後から作成したものを優先する", () => {
    const onLine: Annotation = { ...text, id: "later", x: 0.4, y: 0.49, w: 0.2, h: 0.03 };
    expect(hitTestAnnotations([line, onLine], { x: 0.5, y: 0.5 }, size100)).toBe("later");
    expect(hitTestAnnotations([onLine, line], { x: 0.5, y: 0.5 }, size100)).toBe("line");
  });
  it("倍率100％と80％で同じ結果になる（表示上のpx許容幅を使うため、十分離れた点で比較）", () => {
    const pts = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.53 },
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.5 },
    ];
    for (const p of pts) {
      expect(hitTestAnnotations([line, circle, text], p, size80)).toBe(
        hitTestAnnotations([line, circle, text], p, size100),
      );
    }
  });
  it("点だけのストローク（ドット）も選択できる", () => {
    const dot: Annotation = { ...line, id: "dot", points: [{ x: 0.5, y: 0.5 }] };
    expect(hitTestAnnotations([dot], { x: 0.5, y: 0.5 }, size100)).toBe("dot");
  });
});
