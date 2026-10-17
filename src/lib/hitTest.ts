import type { Annotation, Point, Size } from "./types";

const TOLERANCE_PX = 4;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.min(Math.max(t, 0), 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * 第47.2節：クリック位置（正規化座標）から、選択するAnnotationのIDを返す。
 * 距離は表示サイズのpxに戻して比較する。ストロークは線分との距離のみで判定する。
 */
export function hitTestAnnotations(
  annotations: Annotation[],
  point: Point,
  size: Size,
): string | null {
  const p = { x: point.x * size.width, y: point.y * size.height };
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.type === "text") {
      const x0 = a.x * size.width;
      const y0 = a.y * size.height;
      if (p.x >= x0 && p.x <= x0 + a.w * size.width && p.y >= y0 && p.y <= y0 + a.h * size.height) {
        return a.id;
      }
    } else {
      const tol = (a.widthRatio * size.height) / 2 + TOLERANCE_PX;
      const pts = a.points.map((q) => ({ x: q.x * size.width, y: q.y * size.height }));
      if (pts.length === 1) {
        if (Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= tol) return a.id;
        continue;
      }
      for (let j = 1; j < pts.length; j++) {
        if (distToSegment(p, pts[j - 1], pts[j]) <= tol) return a.id;
      }
    }
  }
  return null;
}

/** 選択枠用の外接矩形（正規化座標） */
export function annotationBounds(a: Annotation): { x: number; y: number; w: number; h: number } {
  if (a.type === "text") return { x: a.x, y: a.y, w: a.w, h: a.h };
  const xs = a.points.map((p) => p.x);
  const ys = a.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
