import { useEffect, useState } from "react";
import { loadPageRatio, type PDFDocumentProxy } from "../lib/pdfRender";

/** 表示中と前後のページの縦横比（幅/高さ）を PDF.js から取得する（第10節） */
export function usePageRatios(pdf: PDFDocumentProxy | null, left: number) {
  const [ratios, setRatios] = useState<{ pdf: PDFDocumentProxy | null; map: Map<number, number> }>({
    pdf: null,
    map: new Map(),
  });

  useEffect(() => {
    if (!pdf) return;
    let dead = false;
    for (let n = left - 1; n <= left + 2; n++) {
      if (n < 1 || n > pdf.numPages) continue;
      if (ratios.pdf === pdf && ratios.map.has(n)) continue;
      loadPageRatio(pdf, n)
        .then((r) => {
          if (dead) return;
          setRatios((prev) => {
            const base = prev.pdf === pdf ? prev.map : new Map<number, number>();
            if (base.get(n) === r) return prev;
            const map = new Map(base);
            map.set(n, r);
            return { pdf, map };
          });
        })
        .catch(() => {});
    }
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, left]);

  return ratios.pdf === pdf ? ratios.map : new Map<number, number>();
}
