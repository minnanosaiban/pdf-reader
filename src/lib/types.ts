export type ScalePercent = 100 | 90 | 80;
export type PagePlacement = "center" | "top-left" | "top-center";
export type PenTool = "yellow" | "pink" | "red" | "blue";
export type ToolId = "view" | PenTool | "text";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** 座標はすべてページ内の正規化座標（0〜1）。線幅・文字サイズはページ高さに対する比率。 */
export interface StrokeAnnotation {
  id: string;
  type: "stroke";
  pageNumber: number;
  tool: PenTool;
  points: Point[];
  widthRatio: number;
}

export interface TextAnnotation {
  id: string;
  type: "text";
  pageNumber: number;
  /** テキストボックス左上（正規化） */
  x: number;
  y: number;
  /** テキストボックスの大きさ（正規化。確定時にブラウザで測定して保存する） */
  w: number;
  h: number;
  text: string;
  sizeRatio: number;
}

export type Annotation = StrokeAnnotation | TextAnnotation;

export interface DocumentViewState {
  currentPage: number;
  scalePercent: ScalePercent;
  placement: PagePlacement;
}

export interface PenColors {
  yellow: string;
  pink: string;
  red: string;
  blue: string;
}

export interface AppSettings {
  penColors: PenColors;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  penColors: { yellow: "#ffe14a", pink: "#ff7eb6", red: "#e02020", blue: "#1f5fe0" },
  reduceMotion: false,
};

export const DEFAULT_VIEW_STATE: DocumentViewState = {
  currentPage: 1,
  scalePercent: 100,
  placement: "center",
};

export const MARKER_WIDTH_RATIO = 0.022;
export const LINE_WIDTH_RATIO = 0.0026;
export const TEXT_SIZE_RATIO = 0.028;
export const TEXT_FONT = '"Yomogi", "Klee One", "Yu Mincho", cursive';
export const TEXT_COLOR = "#1b2a49";

export function isMarker(tool: PenTool): boolean {
  return tool === "yellow" || tool === "pink";
}

/** 保存値の検証。不正なら初期値へ戻す（第52A節）。 */
export function sanitizeViewState(v: unknown, numPages: number): DocumentViewState {
  const o = (v ?? {}) as Partial<DocumentViewState>;
  const scale = o.scalePercent === 90 || o.scalePercent === 80 ? o.scalePercent : 100;
  const placement =
    o.placement === "top-left" || o.placement === "top-center" ? o.placement : "center";
  const page =
    typeof o.currentPage === "number" && Number.isInteger(o.currentPage)
      ? Math.min(Math.max(o.currentPage, 1), Math.max(numPages, 1))
      : 1;
  return { currentPage: page, scalePercent: scale, placement };
}
