import { useEffect, useRef } from "react";
import { PDFPage, type PDFPageProps } from "./PDFPage";
import { renderPage } from "../lib/pdfRender";
import type { SpreadLayout } from "../lib/layout";

export const TRANSITION_MS = 200;

type Shared = Omit<PDFPageProps, "pageNumber" | "width" | "height">;

interface Props extends Shared {
  left: number;
  layout: SpreadLayout;
  ratios: Map<number, number>;
  /** ページ送りのたびに増える。倍率・配置の変更では増えない（第11A節） */
  navSeq: number;
  navDir: 1 | -1;
  animate: boolean;
}

/** 連続する2ページ。右が存在しない場合は同じ大きさの空白領域を確保する（第12節）。 */
export function SpreadView(props: Props) {
  const { left, layout, ratios, navSeq, navDir, animate, ...shared } = props;
  const right = left + 1;
  const hasRight = right <= shared.pdf.numPages;
  const ref = useRef<HTMLDivElement>(null);
  const firstSeq = useRef(navSeq);

  // 第21節：160〜220ms の控えめなスライド＋クロスフェード
  useEffect(() => {
    if (navSeq === firstSeq.current || !animate) return;
    ref.current?.animate(
      [
        { opacity: 0.15, transform: `translateX(${navDir * 28}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: TRANSITION_MS, easing: "ease-out" },
    );
  }, [navSeq, navDir, animate]);

  // 第56節：前後ページのみ先読み
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const n of [left - 1, left + 2]) {
        const r = ratios.get(n);
        if (n < 1 || n > shared.pdf.numPages || r === undefined) continue;
        renderPage(shared.pdf, n, Math.round(layout.pageHeight * r), layout.pageHeight).promise.catch(
          () => {},
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [left, layout.pageHeight, ratios, shared.pdf]);

  return (
    <div ref={ref} className="pdf-spread" style={{ gap: layout.gap }}>
      <PDFPage key={`p${left}`} {...shared} pageNumber={left} width={layout.leftWidth} height={layout.pageHeight} />
      {hasRight ? (
        <PDFPage
          key={`p${right}`}
          {...shared}
          pageNumber={right}
          width={layout.rightWidth}
          height={layout.pageHeight}
        />
      ) : (
        <div className="pdf-page-blank" style={{ width: layout.leftWidth, height: layout.pageHeight }} />
      )}
    </div>
  );
}
