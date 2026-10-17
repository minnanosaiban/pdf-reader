import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

/** 第11B節：Canvas 内部ピクセル数の上限（1ページあたり） */
export const MAX_CANVAS_PIXELS = 16_777_216;
const CACHE_LIMIT = 8;

export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data }).promise;
}

export async function loadPageRatio(pdf: PDFDocumentProxy, pageNumber: number): Promise<number> {
  const page = await pdf.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  return vp.width / vp.height;
}

/** 使用する devicePixelRatio（Canvas 上限を超える場合は下げる） */
export function effectiveDpr(width: number, height: number): number {
  const dpr = window.devicePixelRatio || 1;
  const cap = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(width * height, 1));
  return Math.max(0.5, Math.min(dpr, cap));
}

// 第22節：キャッシュキーは pageNumber + 表示サイズ + 使用した devicePixelRatio
const cache = new Map<string, HTMLCanvasElement>();
const inflight = new Map<string, Promise<HTMLCanvasElement>>();
let cacheOwner: PDFDocumentProxy | null = null;

export const cacheKey = (page: number, w: number, h: number, dpr: number) =>
  `${page}|${w}x${h}|${dpr.toFixed(3)}`;

function touch(key: string, canvas: HTMLCanvasElement) {
  cache.delete(key);
  cache.set(key, canvas);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

/** キャッシュにあれば同期的に返す（ページ移動時のちらつきを防ぐ） */
export function getCached(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  width: number,
  height: number,
): HTMLCanvasElement | undefined {
  if (cacheOwner !== pdf) return undefined;
  const key = cacheKey(pageNumber, width, height, effectiveDpr(width, height));
  const hit = cache.get(key);
  if (hit) touch(key, hit);
  return hit;
}

export interface RenderHandle {
  promise: Promise<HTMLCanvasElement>;
  cancel: () => void;
}

/** オフスクリーン Canvas へ描画して返す。キャッシュがあれば再利用する。 */
export function renderPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  width: number,
  height: number,
): RenderHandle {
  if (cacheOwner !== pdf) {
    cache.clear();
    inflight.clear();
    cacheOwner = pdf;
  }
  const dpr = effectiveDpr(width, height);
  const key = cacheKey(pageNumber, width, height, dpr);
  const hit = cache.get(key);
  if (hit) {
    touch(key, hit);
    return { promise: Promise.resolve(hit), cancel: () => {} };
  }
  let cancelled = false;
  let task: { cancel: () => void } | null = null;
  const shared = inflight.get(key);
  if (shared) return { promise: shared, cancel: () => {} };

  const promise = (async () => {
    const page = await pdf.getPage(pageNumber);
    const bw = Math.max(1, Math.round(width * dpr));
    const bh = Math.max(1, Math.round(height * dpr));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: bw / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = bw;
    canvas.height = bh;
    const rt = page.render({ canvas, viewport });
    task = rt;
    try {
      await rt.promise;
    } finally {
      inflight.delete(key);
    }
    if (cancelled) throw new Error("cancelled");
    touch(key, canvas);
    return canvas;
  })();
  inflight.set(key, promise);
  promise.catch(() => inflight.delete(key));
  return {
    promise,
    cancel: () => {
      cancelled = true;
      // 古い描画タスクは新しい描画を始める前にキャンセルする（第11B節）
      (task as { cancel: () => void } | null)?.cancel();
    },
  };
}
