import { useEffect, useMemo, useState, type RefObject } from "react";
import { computeSpreadLayout, marginsFor, type Margins, type SpreadLayout } from "../lib/layout";
import type { ScalePercent } from "../lib/types";

/**
 * Workspace のサイズ・ページ比率・倍率から、2ページの表示サイズを算出する（第59節）。
 * ウィンドウ・設定パネルの開閉でサイズが変わったら、fitSize → 倍率の順に再計算される。
 */
export function useSpreadLayout(
  workspaceRef: RefObject<HTMLElement | null>,
  ratios: readonly [number, number] | null,
  scalePercent: ScalePercent,
): { layout: SpreadLayout | null; margins: Margins } {
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [workspaceRef]);

  const margins = useMemo(() => marginsFor(viewport.w, viewport.h), [viewport]);
  const r0 = ratios?.[0];
  const r1 = ratios?.[1];
  const layout = useMemo(
    () =>
      r0 === undefined || r1 === undefined
        ? null
        : computeSpreadLayout(size, [r0, r1], margins, scalePercent),
    [size, r0, r1, margins, scalePercent],
  );
  return { layout, margins };
}
