export const WHEEL_THRESHOLD_PX = 100;
export const WHEEL_GESTURE_END_MS = 180;
export const LINE_HEIGHT_PX = 16;

export type WheelPhase = "idle" | "collecting" | "latched";

export interface WheelState {
  phase: WheelPhase;
  accumulator: number;
}

export const INITIAL_WHEEL_STATE: WheelState = { phase: "idle", accumulator: 0 };

/** 第27節：PIXEL / LINE / PAGE をピクセル相当にそろえる。 */
export function normalizeDeltaY(deltaY: number, deltaMode: number, pageHeightPx: number): number {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX;
  if (deltaMode === 2) return deltaY * pageHeightPx;
  return deltaY;
}

/**
 * 第29・35節：累積と閾値判定だけを行う純粋関数。
 * 除外判定・タイマー・アニメーション中の扱いは呼び出し側（createWheelController）が行う。
 * 戻り値の navigate は +1（次）/ -1（前）/ 0（移動なし）。
 */
export function wheelStep(
  state: WheelState,
  delta: number,
  threshold = WHEEL_THRESHOLD_PX,
): { state: WheelState; navigate: 0 | 1 | -1 } {
  if (delta === 0 || state.phase === "latched") return { state, navigate: 0 };
  let acc = state.accumulator;
  if (state.phase === "collecting" && Math.sign(delta) !== Math.sign(acc)) acc = 0;
  acc += delta;
  if (Math.abs(acc) < threshold) {
    return { state: { phase: "collecting", accumulator: acc }, navigate: 0 };
  }
  return { state: { phase: "latched", accumulator: 0 }, navigate: acc > 0 ? 1 : -1 };
}

export interface WheelEventLike {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
  preventDefault(): void;
}

export interface WheelControllerOptions {
  navigate: (direction: 1 | -1) => void;
  /** 入力欄・ポップオーバー・編集中・描画中などの除外（ページ遷移アニメーションは含めない） */
  isExcluded: (e: WheelEventLike) => boolean;
  isTransitioning: () => boolean;
  pageHeightPx?: () => number;
  thresholdPx?: number;
  gestureEndMs?: number;
}

/** 第35節：状態とジェスチャー終了タイマーを持つコントローラ。DOMには依存しない。 */
export function createWheelController(opts: WheelControllerOptions) {
  let state: WheelState = INITIAL_WHEEL_STATE;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const endMs = opts.gestureEndMs ?? WHEEL_GESTURE_END_MS;

  function restartTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      state = INITIAL_WHEEL_STATE;
      timer = null;
    }, endMs);
  }

  return {
    handle(e: WheelEventLike) {
      if (e.ctrlKey || e.metaKey) return; // ブラウザズーム・ピンチ：抑制しない
      if (opts.isExcluded(e)) return;
      const delta = normalizeDeltaY(e.deltaY, e.deltaMode, opts.pageHeightPx?.() ?? 800);
      if (delta === 0) return;
      e.preventDefault();
      restartTimer(); // latched 中・アニメーション中も延長する（第30節）
      if (opts.isTransitioning()) return;
      const r = wheelStep(state, delta, opts.thresholdPx);
      state = r.state;
      if (r.navigate !== 0) opts.navigate(r.navigate);
    },
    getState: () => state,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
