import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PageJumpInput } from "./components/PageJumpInput";
import type { EditingState } from "./components/PDFPage";
import { SettingsPanel } from "./components/SettingsPanel";
import { SpreadView, TRANSITION_MS } from "./components/SpreadView";
import { ToolPalette } from "./components/ToolPalette";
import { ViewDisplayPopover } from "./components/ViewDisplayPopover";
import { useSpreadLayout } from "./hooks/useSpreadLayout";
import { usePageRatios } from "./hooks/usePageRatios";
import { useWheelNavigation } from "./hooks/useWheelNavigation";
import { measureText } from "./lib/draw";
import { canHash, computeDocumentId } from "./lib/documentId";
import { emptyHistory, historyReducer } from "./lib/history";
import { placementLabel, scaleLabel } from "./lib/layout";
import { openPdf, type PDFDocumentProxy } from "./lib/pdfRender";
import { loadDocument, loadSettings, saveDocument, saveSettings } from "./lib/storage";
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIEW_STATE,
  TEXT_SIZE_RATIO,
  sanitizeViewState,
  type Annotation,
  type AppSettings,
  type PagePlacement,
  type PenTool,
  type Point,
  type ScalePercent,
  type ToolId,
} from "./lib/types";

const AUTOSAVE_DEBOUNCE_MS = 500;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const newId = () => crypto.randomUUID?.() ?? `a${Date.now()}${Math.random().toString(36).slice(2)}`;

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

export function App() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [scalePercent, setScalePercent] = useState<ScalePercent>(100);
  const [placement, setPlacement] = useState<PagePlacement>("center");
  const [tool, setTool] = useState<ToolId>("view");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [nav, setNav] = useState<{ seq: number; dir: 1 | -1 }>({ seq: 0, dir: 1 });
  const [announcement, setAnnouncement] = useState("");

  const [history, dispatch] = useReducer(historyReducer, emptyHistory);
  const annotations = history.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditingState] = useState<EditingState | null>(null);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const displayBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const transitioningRef = useRef(false);
  const editingRef = useRef<EditingState | null>(null);
  const currentRef = useRef(1);
  const editKeyRef = useRef(0);
  const restoredRef = useRef(false);
  const settingsLoadedRef = useRef(false);

  const numPages = pdf?.numPages ?? 0;
  const persistenceAvailable = canHash();
  const prefersReduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = !settings.reduceMotion && !prefersReduced;

  const setEditing = (e: EditingState | null) => {
    editingRef.current = e;
    setEditingState(e);
  };

  /* ---------- レイアウト ---------- */

  const ratioMap = usePageRatios(pdf, currentPage);
  const leftRatio = ratioMap.get(currentPage);
  const hasRight = currentPage + 1 <= numPages;
  const rightRatio = hasRight ? ratioMap.get(currentPage + 1) : leftRatio;
  const ratios = useMemo(
    () => (leftRatio !== undefined && rightRatio !== undefined ? ([leftRatio, rightRatio] as const) : null),
    [leftRatio, rightRatio],
  );
  const { layout, margins } = useSpreadLayout(workspaceRef, pdf ? ratios : null, scalePercent);

  /* ---------- 文書の読み込み・復元 ---------- */

  const loadFile = useCallback(
    async (file: File) => {
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        setNotice("PDFファイルを選んでください。");
        return;
      }
      restoredRef.current = false;
      setNotice(null);
      setStatus("読み込み中…");
      try {
        let id: string | null = null;
        if (canHash()) id = await computeDocumentId(file);
        else setNotice("保存と復元は利用できません");
        const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
        let saved;
        if (id) saved = await loadDocument(id).catch(() => undefined);
        const view = sanitizeViewState(saved?.viewState ?? DEFAULT_VIEW_STATE, doc.numPages);
        setPdf(doc);
        setDocumentId(id);
        setFileName(file.name);
        dispatch({ type: "load", annotations: saved?.annotations ?? [] });
        setSelectedId(null);
        setEditing(null);
        currentRef.current = view.currentPage;
        setCurrentPage(view.currentPage);
        setScalePercent(view.scalePercent);
        setPlacement(view.placement);
        setPopoverAnchor(null);
        restoredRef.current = true;
      } catch (err) {
        setNotice(`PDFを開けませんでした：${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setStatus(null);
      }
    },
    [],
  );

  useEffect(() => {
    loadSettings()
      .then((s) => {
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...s, penColors: { ...DEFAULT_SETTINGS.penColors, ...s.penColors } });
      })
      .catch(() => {})
      .finally(() => {
        settingsLoadedRef.current = true;
      });
  }, []);

  /* ---------- 自動保存（第51節） ---------- */

  useEffect(() => {
    if (!documentId || !restoredRef.current) return;
    const t = setTimeout(() => {
      saveDocument(documentId, {
        annotations,
        viewState: { currentPage, scalePercent, placement },
        savedAt: Date.now(),
      }).catch(() => {});
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [documentId, annotations, currentPage, scalePercent, placement]);

  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    const t = setTimeout(() => saveSettings(settings).catch(() => {}), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [settings]);

  /* ---------- 文字入力 ---------- */

  const commitEditing = useCallback((key?: number) => {
    const e = editingRef.current;
    if (!e || (key !== undefined && e.key !== key)) return;
    editingRef.current = null;
    setEditingState(null);
    const text = e.text.replace(/\s+$/, "");
    if (e.id) {
      if (text === "") {
        dispatch({ type: "remove", id: e.id }); // 空にして確定すると削除（Undoで戻せる）
        return;
      }
      const m = measureText(text, TEXT_SIZE_RATIO, e.pageW, e.pageH);
      dispatch({
        type: "editText",
        id: e.id,
        patch: { text, x: clamp(e.x, 0, Math.max(0, 1 - m.w)), y: clamp(e.y, 0, Math.max(0, 1 - m.h)), w: m.w, h: m.h },
      });
      return;
    }
    if (text === "") return; // 空の入力は確定せず破棄
    const m = measureText(text, TEXT_SIZE_RATIO, e.pageW, e.pageH);
    const a: Annotation = {
      id: newId(),
      type: "text",
      pageNumber: e.pageNumber,
      x: clamp(e.x, 0, Math.max(0, 1 - m.w)),
      y: clamp(e.y, 0, Math.max(0, 1 - m.h)),
      w: m.w,
      h: m.h,
      text,
      sizeRatio: TEXT_SIZE_RATIO,
    };
    dispatch({ type: "add", annotation: a });
  }, []);

  const startText = (pageNumber: number, p: Point, pageW: number, pageH: number) => {
    commitEditing();
    setSelectedId(null);
    setEditing({
      key: ++editKeyRef.current,
      id: null,
      pageNumber,
      x: clamp(p.x, 0, 0.9),
      y: clamp(p.y - (TEXT_SIZE_RATIO * 1.3) / 2, 0, 0.97),
      text: "",
      pageW,
      pageH,
    });
  };

  const editExisting = (id: string) => {
    const a = annotations.find((x) => x.id === id);
    if (!a || a.type !== "text") return;
    commitEditing();
    const pageEl = workspaceRef.current?.querySelector<HTMLElement>(`.pdf-page[data-page="${a.pageNumber}"]`);
    if (!pageEl) return;
    setSelectedId(id);
    setEditing({
      key: ++editKeyRef.current,
      id,
      pageNumber: a.pageNumber,
      x: a.x,
      y: a.y,
      text: a.text,
      pageW: pageEl.clientWidth,
      pageH: pageEl.clientHeight,
    });
  };

  /* ---------- ページ移動（共通関数・第18節） ---------- */

  const goToPage = useCallback(
    (page: number): boolean => {
      if (numPages === 0 || drawingRef.current || editingRef.current) return false;
      const target = clamp(Math.round(page), 1, numPages);
      const cur = currentRef.current;
      if (target === cur) return false; // 先頭・末尾：移動もアニメーションもしない（第31節）
      currentRef.current = target;
      setCurrentPage(target);
      setNav((n) => ({ seq: n.seq + 1, dir: target > cur ? 1 : -1 }));
      if (animate) {
        transitioningRef.current = true;
        setTimeout(() => {
          transitioningRef.current = false;
        }, TRANSITION_MS + 20);
      }
      setAnnouncement(`ページ ${target}${target + 1 <= numPages ? `、${target + 1}` : ""} / ${numPages}`);
      return true;
    },
    [numPages, animate],
  );
  const navigateNextPage = useCallback(() => goToPage(currentRef.current + 1), [goToPage]);
  const navigatePreviousPage = useCallback(() => goToPage(currentRef.current - 1), [goToPage]);

  // 移動後に表示されないページのAnnotationが選択中なら解除（第47.1節）
  useEffect(() => {
    if (!selectedId) return;
    const a = annotations.find((x) => x.id === selectedId);
    if (!a || (a.pageNumber !== currentPage && a.pageNumber !== currentPage + 1)) setSelectedId(null);
  }, [currentPage, annotations, selectedId]);

  useWheelNavigation(workspaceRef, {
    navigate: (d) => (d > 0 ? navigateNextPage() : navigatePreviousPage()),
    isTransitioning: () => transitioningRef.current,
    isBusy: () => drawingRef.current || editingRef.current !== null,
  });

  /* ---------- 操作 ---------- */

  const changeTool = (t: ToolId) => {
    commitEditing();
    setTool(t);
    setSelectedId(null); // 筆記具に切り替えると選択解除
    if (t === "view") setSelectedId(null);
  };

  const openDisplay = () => {
    if (drawingRef.current) return;
    commitEditing(); // 文字入力中は自動確定してから開く（第41節）
    if (popoverAnchor) {
      setPopoverAnchor(null);
      return;
    }
    const r = displayBtnRef.current?.getBoundingClientRect();
    if (r) setPopoverAnchor(r);
  };

  const announceView = (s: ScalePercent, p: PagePlacement) =>
    setAnnouncement(`表示倍率 ${s === 100 ? "フィット" : s + "％"}、${placementLabel(p)}`);

  const onStroke = (pageNumber: number, t: PenTool, points: Point[], widthRatio: number) => {
    dispatch({
      type: "add",
      annotation: { id: newId(), type: "stroke", pageNumber, tool: t, points, widthRatio },
    });
  };

  const removeSelected = () => {
    if (!selectedId) return;
    dispatch({ type: "remove", id: selectedId });
    setSelectedId(null);
  };

  /* ---------- キーボード ---------- */

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    const typing = isTypingTarget(e.target);
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === "g" && pdf) {
      e.preventDefault();
      commitEditing();
      setJumpOpen(true);
      return;
    }
    if (e.key === "Escape") {
      if (popoverAnchor) setPopoverAnchor(null);
      else if (jumpOpen) setJumpOpen(false);
      else if (editingRef.current) commitEditing();
      else if (selectedId) setSelectedId(null);
      return;
    }
    if (typing) return; // 入力中は Undo/Redo・ページ送り等を入力欄に任せる（第47.3節）

    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (k === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
      return;
    }
    if (e.altKey) return;

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if ((e.target as HTMLElement | null)?.closest?.('[role="radiogroup"]')) return;
      e.preventDefault();
      if (e.key === "ArrowRight") navigateNextPage();
      else navigatePreviousPage();
    } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      e.preventDefault();
      removeSelected();
    } else if (e.key === "Enter" && selectedId) {
      const a = annotations.find((x) => x.id === selectedId);
      if (a?.type === "text") {
        e.preventDefault();
        editExisting(a.id);
      }
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ポップオーバー：外側クリックで閉じる
  useEffect(() => {
    if (!popoverAnchor) return;
    const h = (e: PointerEvent) => {
      const t = e.target as Element;
      if (t.closest("[data-popover], [data-display-button]")) return;
      setPopoverAnchor(null);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [popoverAnchor]);

  /* ---------- ドラッグ＆ドロップ ---------- */

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void loadFile(f);
  };

  const cssVars = {
    "--page-margin-x": `${margins.x}px`,
    "--page-margin-y": `${margins.y}px`,
    "--page-gap": `${margins.gap}px`,
  } as React.CSSProperties;

  return (
    <div
      className="app"
      style={cssVars}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <ToolPalette
        ref={displayBtnRef}
        tool={tool}
        onTool={changeTool}
        colors={settings.penColors}
        scalePercent={scalePercent}
        displayOpen={popoverAnchor !== null}
        onDisplay={openDisplay}
        settingsOpen={settingsOpen}
        onSettings={() => {
          commitEditing();
          setSettingsOpen((v) => !v);
        }}
        currentPage={currentPage}
        numPages={numPages}
        onOpenJump={() => {
          commitEditing();
          setJumpOpen(true);
        }}
        hasDocument={!!pdf}
      />

      <div
        ref={workspaceRef}
        className="pdf-workspace"
        data-placement={placement}
        onPointerDown={(e) => {
          if (!(e.target as Element).closest(".pdf-page")) {
            commitEditing();
            setSelectedId(null); // PDF外の余白のクリックで選択解除
          }
        }}
      >
        {pdf && layout && (
          <SpreadView
            pdf={pdf}
            left={currentPage}
            layout={layout}
            ratios={ratioMap}
            navSeq={nav.seq}
            navDir={nav.dir}
            animate={animate}
            tool={tool}
            annotations={annotations}
            selectedId={selectedId}
            editing={editing}
            colors={settings.penColors}
            textSizeRatio={TEXT_SIZE_RATIO}
            isBlocked={() => transitioningRef.current}
            drawingRef={drawingRef}
            onSelect={setSelectedId}
            onEditExisting={editExisting}
            onStroke={onStroke}
            onStartText={startText}
            onEditingChange={(text) => {
              const e = editingRef.current;
              if (e) setEditing({ ...e, text });
            }}
            onEditingCommit={commitEditing}
          />
        )}
        {!pdf && (
          <div className="empty-state" data-wheel-exclude>
            <p className="empty-title">連続2ページPDFリーダー</p>
            <p>PDFをここへドラッグ＆ドロップするか、ファイルを選んでください。</p>
            <button type="button" className="primary-btn" onClick={() => fileInputRef.current?.click()}>
              PDFを開く
            </button>
            <p className="empty-note">処理はすべてブラウザ内で完結し、外部送信はありません。</p>
          </div>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onOpenFile={() => fileInputRef.current?.click()}
          onClose={() => setSettingsOpen(false)}
          persistenceAvailable={persistenceAvailable}
        />
      )}

      {popoverAnchor && (
        <ViewDisplayPopover
          anchor={popoverAnchor}
          scalePercent={scalePercent}
          placement={placement}
          onScale={(s) => {
            setScalePercent(s);
            announceView(s, placement);
          }}
          onPlacement={(p) => {
            setPlacement(p);
            announceView(scalePercent, p);
          }}
          onClose={() => setPopoverAnchor(null)}
        />
      )}

      {jumpOpen && pdf && (
        <PageJumpInput
          current={currentPage}
          numPages={numPages}
          onGo={goToPage}
          onClose={() => setJumpOpen(false)}
        />
      )}

      {(status || notice || dragging) && (
        <div className="toast" role="status" data-wheel-exclude>
          {dragging ? "ここにドロップしてPDFを開く" : (status ?? notice)}
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <div className="sr-only">{fileName && `${fileName}　${scaleLabel(scalePercent)}`}</div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void loadFile(f);
        }}
      />
    </div>
  );
}
