import { forwardRef } from "react";
import { DisplayIcon, LineIcon, MarkerIcon, SettingsIcon, TextIcon, ViewIcon } from "./Icons";
import type { PenColors, ScalePercent, ToolId } from "../lib/types";

interface Props {
  tool: ToolId;
  onTool: (t: ToolId) => void;
  colors: PenColors;
  scalePercent: ScalePercent;
  displayOpen: boolean;
  onDisplay: () => void;
  settingsOpen: boolean;
  onSettings: () => void;
  currentPage: number;
  numPages: number;
  onOpenJump: () => void;
  hasDocument: boolean;
}

/** 第16節：左端のツールバー領域。PDFには重ならない。 */
export const ToolPalette = forwardRef<HTMLButtonElement, Props>(function ToolPalette(p, displayRef) {
  const tools: { id: ToolId; label: string; icon: React.ReactNode }[] = [
    { id: "view", label: "閲覧", icon: <ViewIcon /> },
    { id: "yellow", label: "黄色マーカー", icon: <MarkerIcon color={p.colors.yellow} /> },
    { id: "pink", label: "ピンクマーカー", icon: <MarkerIcon color={p.colors.pink} /> },
    { id: "red", label: "赤ライン", icon: <LineIcon color={p.colors.red} /> },
    { id: "blue", label: "青ライン", icon: <LineIcon color={p.colors.blue} /> },
    { id: "text", label: "手書き風文字", icon: <TextIcon /> },
  ];
  return (
    <div
      className="tool-palette"
      role="toolbar"
      aria-label="ツール"
      aria-orientation="vertical"
      data-wheel-exclude
    >
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tool-btn"
          aria-label={t.label}
          title={t.label}
          aria-pressed={p.tool === t.id}
          data-active={p.tool === t.id}
          disabled={!p.hasDocument && t.id !== "view"}
          onClick={() => p.onTool(t.id)}
        >
          {t.icon}
        </button>
      ))}
      <div className="tool-sep" />
      <button
        ref={displayRef}
        type="button"
        className="tool-btn"
        data-display-button
        aria-label="表示"
        title="表示（倍率・配置）"
        aria-haspopup="true"
        aria-expanded={p.displayOpen}
        data-active={p.displayOpen}
        data-shrunk={p.scalePercent !== 100}
        disabled={!p.hasDocument}
        onClick={p.onDisplay}
      >
        <DisplayIcon />
      </button>
      <button
        type="button"
        className="tool-btn"
        aria-label="設定"
        title="設定"
        aria-pressed={p.settingsOpen}
        data-active={p.settingsOpen}
        onClick={p.onSettings}
      >
        <SettingsIcon />
      </button>
      <div className="tool-spacer" />
      {p.hasDocument && (
        <button
          type="button"
          className="page-indicator"
          aria-label={`ページ指定（現在 ${p.currentPage} / ${p.numPages}）`}
          title="ページ指定 (Ctrl+G)"
          onClick={p.onOpenJump}
        >
          <span>{p.currentPage}</span>
          <span className="page-indicator-total">/ {p.numPages}</span>
        </button>
      )}
    </div>
  );
});
