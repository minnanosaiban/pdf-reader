import type { Point } from "./types";

export const isInsidePage = (p: Point) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

/**
 * 第11D節：prev（ページ内）から next（ページ外）への線分と、ページ境界（0〜1の正方形）の交点を返す。
 * ページ外の点をページ端へ押し込む（clamp）ことはしない。
 */
export function exitIntersection(prev: Point, next: Point): Point {
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  let t = 1;
  const consider = (num: number, den: number) => {
    if (den === 0) return;
    const c = num / den;
    if (c >= 0 && c < t) t = c;
  };
  if (next.x < 0) consider(0 - prev.x, dx);
  if (next.x > 1) consider(1 - prev.x, dx);
  if (next.y < 0) consider(0 - prev.y, dy);
  if (next.y > 1) consider(1 - prev.y, dy);
  return { x: prev.x + dx * t, y: prev.y + dy * t };
}

export interface StrokeBuilder {
  points: Point[];
  ended: boolean;
}

export function startStroke(p: Point): StrokeBuilder {
  return { points: [p], ended: false };
}

/** 点を追加する。ページ外へ出たら交点を最後の点として追加し、終了する（再開しない）。 */
export function extendStroke(s: StrokeBuilder, p: Point): StrokeBuilder {
  if (s.ended) return s;
  const prev = s.points[s.points.length - 1];
  if (isInsidePage(p)) return { points: [...s.points, p], ended: false };
  return { points: [...s.points, exitIntersection(prev, p)], ended: true };
}
