import { annotationBounds } from "./hitTest";
import {
  TEXT_COLOR,
  TEXT_FONT,
  isMarker,
  type Annotation,
  type PenColors,
  type Point,
  type StrokeAnnotation,
} from "./types";

/** id から決まる擬似乱数（再描画しても揺れが変わらない） */
function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Point[], w: number, h: number) {
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    ctx.lineTo(pts[0].x * w + 0.01, pts[0].y * h);
    return;
  }
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2) * w;
    const my = ((pts[i].y + pts[i + 1].y) / 2) * h;
    ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x * w, last.y * h);
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  a: Pick<StrokeAnnotation, "id" | "tool" | "points" | "widthRatio">,
  w: number,
  h: number,
  colors: PenColors,
) {
  if (a.points.length === 0) return;
  const color = colors[a.tool];
  const width = a.widthRatio * h;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  if (isMarker(a.tool)) {
    // 半透明で、幅と濃さにわずかな揺れを持たせる（完全な長方形にしない）
    const rnd = seeded(a.id);
    ctx.globalAlpha = 0.36;
    ctx.lineWidth = width;
    tracePath(ctx, a.points, w, h);
    ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = width * (0.55 + rnd() * 0.15);
    const jitter = a.points.map((p) => ({
      x: p.x + (rnd() - 0.5) * 0.0016 * (h / w),
      y: p.y + (rnd() - 0.5) * 0.0016,
    }));
    tracePath(ctx, jitter, w, h);
    ctx.stroke();
  } else {
    // 細く、ほぼ不透明。微小な手描き感
    const rnd = seeded(a.id);
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = Math.max(width, 1);
    tracePath(ctx, a.points, w, h);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(width * 0.6, 0.8);
    const jitter = a.points.map((p) => ({
      x: p.x + (rnd() - 0.5) * 0.0007,
      y: p.y + (rnd() - 0.5) * 0.0007 * (w / h),
    }));
    tracePath(ctx, jitter, w, h);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  a: Extract<Annotation, { type: "text" }>,
  w: number,
  h: number,
) {
  const size = a.sizeRatio * h;
  ctx.save();
  ctx.font = `${size}px ${TEXT_FONT}`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = "top";
  const lineHeight = size * 1.3;
  a.text.split("\n").forEach((line, i) => {
    ctx.fillText(line, a.x * w, a.y * h + i * lineHeight + (lineHeight - size) / 2);
  });
  ctx.restore();
}

export function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  w: number,
  h: number,
  colors: PenColors,
) {
  if (a.type === "stroke") drawStroke(ctx, a, w, h, colors);
  else drawText(ctx, a, w, h);
}

export function drawSelection(ctx: CanvasRenderingContext2D, a: Annotation, w: number, h: number) {
  const b = annotationBounds(a);
  const pad = a.type === "stroke" ? (a.widthRatio * h) / 2 + 4 : 3;
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2f6fed";
  ctx.strokeRect(b.x * w - pad, b.y * h - pad, b.w * w + pad * 2, b.h * h + pad * 2);
  ctx.restore();
}

/** テキストの大きさを測定して、ページに対する正規化サイズを返す（確定時に保存する） */
export function measureText(
  text: string,
  sizeRatio: number,
  pageW: number,
  pageH: number,
): { w: number; h: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const size = sizeRatio * pageH;
  ctx.font = `${size}px ${TEXT_FONT}`;
  const lines = text.split("\n");
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width), size * 0.5);
  return { w: (width + 2) / pageW, h: (lines.length * size * 1.3) / pageH };
}
