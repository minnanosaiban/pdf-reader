import { describe, expect, it } from "vitest";
import { exitIntersection, extendStroke, startStroke } from "./stroke";

describe("exitIntersection", () => {
  it("右へ出る線分とページ境界の交点を返す（clamp ではない）", () => {
    const p = exitIntersection({ x: 0.9, y: 0.5 }, { x: 1.3, y: 0.7 });
    expect(p.x).toBeCloseTo(1, 10);
    expect(p.y).toBeCloseTo(0.55, 10);
  });
  it("上へ出る場合", () => {
    const p = exitIntersection({ x: 0.5, y: 0.1 }, { x: 0.7, y: -0.3 });
    expect(p.y).toBeCloseTo(0, 10);
    expect(p.x).toBeCloseTo(0.55, 10);
  });
  it("角から斜めに出る場合は先に当たる辺を使う", () => {
    const p = exitIntersection({ x: 0.95, y: 0.5 }, { x: 1.5, y: 2 });
    expect(p.y).toBeLessThanOrEqual(1);
    expect(p.x).toBeLessThanOrEqual(1);
  });
});

describe("extendStroke", () => {
  it("ページ外へ出たらその時点で終了し、以降は再開しない", () => {
    let s = startStroke({ x: 0.5, y: 0.5 });
    s = extendStroke(s, { x: 0.9, y: 0.5 });
    s = extendStroke(s, { x: 1.2, y: 0.5 });
    expect(s.ended).toBe(true);
    expect(s.points[s.points.length - 1].x).toBeCloseTo(1, 10);
    const n = s.points.length;
    s = extendStroke(s, { x: 0.5, y: 0.5 }); // ページ内へ戻っても再開しない
    expect(s.points.length).toBe(n);
  });
  it("ページ外の点がページ端に沿って残らない", () => {
    let s = startStroke({ x: 0.5, y: 0.5 });
    s = extendStroke(s, { x: 1.4, y: 0.9 });
    s = extendStroke(s, { x: 1.4, y: 0.1 });
    expect(s.points.every((p) => p.x <= 1 && p.x >= 0 && p.y >= 0 && p.y <= 1)).toBe(true);
    expect(s.points).toHaveLength(2);
  });
});
