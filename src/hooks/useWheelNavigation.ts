import { useEffect, useRef, type RefObject } from "react";
import { createWheelController, type WheelEventLike } from "../lib/wheel";

interface Options {
  navigate: (direction: 1 | -1) => void;
  isTransitioning: () => boolean;
  /** 編集中・描画中など、DOM 以外の除外条件 */
  isBusy: () => boolean;
}

const EXCLUDE_SELECTOR = 'input, textarea, select, [data-wheel-exclude], [role="dialog"]';

/** 第34節：Workspace 全体（PDF外の余白を含む）でのホイールによるページ送り。 */
export function useWheelNavigation(ref: RefObject<HTMLElement | null>, options: Options) {
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controller = createWheelController({
      navigate: (d) => opts.current.navigate(d),
      isTransitioning: () => opts.current.isTransitioning(),
      isExcluded: (e: WheelEventLike) => {
        const t = e.target as Element | null;
        if (t && typeof t.closest === "function" && t.closest(EXCLUDE_SELECTOR)) return true;
        return opts.current.isBusy();
      },
      pageHeightPx: () => el.clientHeight,
    });
    const onWheel = (e: WheelEvent) => controller.handle(e);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      controller.dispose();
    };
  }, [ref]);
}
