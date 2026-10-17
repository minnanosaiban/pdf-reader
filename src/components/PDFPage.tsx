import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { drawAnnotation, drawSelection, drawStroke, measureText } from "../lib/draw";
import { extendStroke, startStroke, type StrokeBuilder } from "../lib/stroke";
import { getCached, renderPage, type PDFDocumentProxy, type RenderHandle } from "../lib/pdfRender";
import { hitTestAnnotations } from "../lib/hitTest";
import {
  LINE_WIDTH_RATIO,
  MARKER_WIDTH_RATIO,
  TEXT_COLOR,
  TEXT_FONT,
  isMarker,
  type Annotation,
  type PenColors,
  type PenTool,
  type Point,
  type ToolId,
} from "../lib/types";

export interface EditingState {
  key: number;
  /** 既存テキストの再編集なら ID。新規なら null */
  id: string | null;
  pageNumber: number;
  x: number;
  y: number;
  text: string;
  pageW: number;
  pageH: number;
}

/* ---------- PDFCanvas：PDF.js によるページ描画のみ ---------- */

function PDFCanvas({
  pdf,
  pageNumber,
  width,
  height,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    let handle: RenderHandle | null = null;
    const paint = (src: HTMLCanvasElement) => {
      const c = ref.current;
      if (dead || !c) return;
      if (c.width !== src.width || c.height !== src.height) {
        c.width = src.width;
        c.height = src.height;
      }
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(src, 0, 0);
    };
    const cached = getCached(pdf, pageNumber, width, height);
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (cached) {
      paint(cached);
    } else {
      // リサイズや倍率変更の連続操作は最後の1回だけ描画する（第11B節）
      timer = setTimeout(() => {
        handle = renderPage(pdf, pageNumber, width, height);
        handle.promise.then(paint).catch(() => {});
      }, 40);
    }
    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
      handle?.cancel();
    };
  }, [pdf, pageNumber, width, height]);

  return <canvas ref={ref} className="pdf-canvas" aria-hidden="true" />;
}

/* ---------- PageAnnotationLayer：保存済みAnnotationの表示専用 ---------- */

function useFontsTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    document.fonts?.addEventListener?.("loadingdone", bump);
    document.fonts?.ready.then(bump);
    return () => document.fonts?.removeEventListener?.("loadingdone", bump);
  }, []);
  return tick;
}

function PageAnnotationLayer({
  annotations,
  selectedId,
  hiddenId,
  colors,
  width,
  height,
}: {
  annotations: Annotation[];
  selectedId: string | null;
  hiddenId: string | null;
  colors: PenColors;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fontsTick = useFontsTick();

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const a of annotations) {
      if (a.id !== hiddenId) drawAnnotation(ctx, a, width, height, colors);
    }
    const sel = annotations.find((a) => a.id === selectedId && a.id !== hiddenId);
    if (sel) drawSelection(ctx, sel, width, height);
  }, [annotations, selectedId, hiddenId, colors, width, height, fontsTick]);

  return <canvas ref={ref} className="annotation-layer" aria-hidden="true" />;
}

/* ---------- InteractionLayer：筆記入力と描画中ストローク ---------- */

function InteractionLayer({
  tool,
  pageNumber,
  width,
  height,
  colors,
  isBlocked,
  drawingRef,
  onStroke,
  onStartText,
}: {
  tool: ToolId;
  pageNumber: number;
  width: number;
  height: number;
  colors: PenColors;
  isBlocked: () => boolean;
  drawingRef: MutableRefObject<boolean>;
  onStroke: (pageNumber: number, tool: PenTool, points: Point[], widthRatio: number) => void;
  onStartText: (pageNumber: number, p: Point, pageW: number, pageH: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<{ b: StrokeBuilder; committed: boolean } | null>(null);
  const penTool: PenTool | null = tool === "view" || tool === "text" ? null : tool;

  const norm = (e: { clientX: number; clientY: number }): Point => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const redraw = () => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(width * dpr)) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const s = stroke.current;
    if (s && penTool && !s.committed) {
      drawStroke(
        ctx,
        {
          id: "live",
          tool: penTool,
          points: s.b.points,
          widthRatio: isMarker(penTool) ? MARKER_WIDTH_RATIO : LINE_WIDTH_RATIO,
        },
        width,
        height,
        colors,
      );
    }
  };

  const finalize = () => {
    const s = stroke.current;
    if (!s || s.committed || !penTool) return;
    s.committed = true;
    onStroke(
      pageNumber,
      penTool,
      s.b.points,
      isMarker(penTool) ? MARKER_WIDTH_RATIO : LINE_WIDTH_RATIO,
    );
    redraw();
  };

  const end = () => {
    finalize();
    stroke.current = null;
    drawingRef.current = false;
    redraw();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isBlocked()) return; // 遷移アニメーション中は開始しない（第21節）
    if (tool === "text") {
      e.preventDefault();
      onStartText(pageNumber, norm(e), width, height);
      return;
    }
    if (!penTool) return;
    wrap.current!.setPointerCapture(e.pointerId); // ページ外へ出ても入力を受け取る（第11D節）
    stroke.current = { b: startStroke(norm(e)), committed: false };
    drawingRef.current = true;
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = stroke.current;
    if (!s || s.b.ended) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      s.b = extendStroke(s.b, norm(ev));
      if (s.b.ended) {
        finalize(); // ページ境界との交点で終了。再開しない
        break;
      }
    }
    redraw();
  };

  return (
    <div
      ref={wrap}
      className="interaction-layer"
      data-tool={tool}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}

/* ---------- 手書き風文字の入力欄 ---------- */

function TextEditor({
  editing,
  sizeRatio,
  onChange,
  onCommit,
}: {
  editing: EditingState;
  sizeRatio: number;
  onChange: (text: string) => void;
  onCommit: (key: number) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // クリックの既定動作（フォーカス移動）が後から走ることがあるため、少し遅らせて再度フォーカスする
    const focus = () => {
      const t = ref.current;
      if (!t || document.activeElement === t) return;
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    };
    const timers = [0, 40, 120].map((ms) => setTimeout(focus, ms));
    return () => timers.forEach(clearTimeout);
  }, [editing.key]);

  const size = sizeRatio * editing.pageH;
  const m = measureText(editing.text || " ", sizeRatio, editing.pageW, editing.pageH);
  const lines = editing.text.split("\n").length;
  const maxW = (1 - editing.x) * editing.pageW;

  return (
    <textarea
      ref={ref}
      className="text-editor"
      aria-label="手書き風文字の入力"
      value={editing.text}
      rows={lines}
      style={{
        left: editing.x * editing.pageW,
        top: editing.y * editing.pageH,
        width: Math.min(Math.max(m.w * editing.pageW + size, 80), maxW),
        fontSize: size,
        lineHeight: 1.3,
        fontFamily: TEXT_FONT,
        color: TEXT_COLOR,
      }}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(editing.key)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCommit(editing.key);
        }
        e.stopPropagation(); // ページ送り・Delete 等を発生させない（第41節）
      }}
    />
  );
}

/* ---------- PDFPage ---------- */

export interface PDFPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  height: number;
  tool: ToolId;
  annotations: Annotation[];
  selectedId: string | null;
  editing: EditingState | null;
  colors: PenColors;
  textSizeRatio: number;
  isBlocked: () => boolean;
  drawingRef: MutableRefObject<boolean>;
  onSelect: (id: string | null) => void;
  onEditExisting: (id: string) => void;
  onStroke: (pageNumber: number, tool: PenTool, points: Point[], widthRatio: number) => void;
  onStartText: (pageNumber: number, p: Point, pageW: number, pageH: number) => void;
  onEditingChange: (text: string) => void;
  onEditingCommit: (key: number) => void;
}

export function PDFPage(props: PDFPageProps) {
  const { pdf, pageNumber, width, height, tool, annotations, selectedId, editing } = props;
  const page = annotations.filter((a) => a.pageNumber === pageNumber);
  const root = useRef<HTMLDivElement>(null);
  const editingHere = editing && editing.pageNumber === pageNumber ? editing : null;

  const hit = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return hitTestAnnotations(
      page,
      { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height },
      { width, height },
    );
  };

  return (
    <div
      ref={root}
      className="pdf-page"
      data-page={pageNumber}
      style={{ width, height }}
      onPointerDown={(e) => {
        // 閲覧ツール時のAnnotation選択：PDFPage でクリックを受け、座標で当たり判定する（第47節）
        if (tool !== "view" || e.button !== 0) return;
        props.onSelect(hit(e));
      }}
      onDoubleClick={(e) => {
        if (tool !== "view") return;
        const id = hit(e);
        if (id && page.find((a) => a.id === id)?.type === "text") props.onEditExisting(id);
      }}
    >
      <PDFCanvas pdf={pdf} pageNumber={pageNumber} width={width} height={height} />
      <PageAnnotationLayer
        annotations={page}
        selectedId={selectedId}
        hiddenId={editingHere?.id ?? null}
        colors={props.colors}
        width={width}
        height={height}
      />
      <InteractionLayer
        tool={tool}
        pageNumber={pageNumber}
        width={width}
        height={height}
        colors={props.colors}
        isBlocked={props.isBlocked}
        drawingRef={props.drawingRef}
        onStroke={props.onStroke}
        onStartText={props.onStartText}
      />
      {editingHere && (
        <TextEditor
          editing={editingHere}
          sizeRatio={props.textSizeRatio}
          onChange={props.onEditingChange}
          onCommit={props.onEditingCommit}
        />
      )}
    </div>
  );
}
