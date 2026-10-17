import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_WHEEL_STATE,
  createWheelController,
  normalizeDeltaY,
  wheelStep,
  type WheelEventLike,
} from "./wheel";

describe("wheelStep（純粋関数）", () => {
  it("閾値未満では移動せず collecting になる", () => {
    const r = wheelStep(INITIAL_WHEEL_STATE, 40);
    expect(r.navigate).toBe(0);
    expect(r.state).toEqual({ phase: "collecting", accumulator: 40 });
  });
  it("閾値以上で1ページ移動し latched になる", () => {
    let s = wheelStep(INITIAL_WHEEL_STATE, 60).state;
    const r = wheelStep(s, 60);
    expect(r.navigate).toBe(1);
    expect(r.state.phase).toBe("latched");
    s = r.state;
    expect(wheelStep(s, 500).navigate).toBe(0);
  });
  it("collecting 中の方向反転で累積がリセットされる", () => {
    const s = wheelStep(INITIAL_WHEEL_STATE, 80).state;
    const r = wheelStep(s, -30);
    expect(r.state.accumulator).toBe(-30);
    expect(r.navigate).toBe(0);
  });
  it("latched 中の方向反転は無視される", () => {
    const latched = wheelStep(INITIAL_WHEEL_STATE, 200).state;
    const r = wheelStep(latched, -500);
    expect(r.navigate).toBe(0);
    expect(r.state).toBe(latched);
  });
  it("負方向は前ページ", () => {
    expect(wheelStep(INITIAL_WHEEL_STATE, -120).navigate).toBe(-1);
  });
});

describe("normalizeDeltaY", () => {
  it("LINE / PAGE をピクセルへ換算する", () => {
    expect(normalizeDeltaY(3, 1, 800)).toBe(48);
    expect(normalizeDeltaY(1, 2, 800)).toBe(800);
    expect(normalizeDeltaY(7, 0, 800)).toBe(7);
  });
});

describe("createWheelController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const ev = (deltaY: number, extra: Partial<WheelEventLike> = {}): WheelEventLike => ({
    deltaY,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...extra,
  });

  function setup(transitioning = () => false, excluded = () => false) {
    const navigate = vi.fn();
    const c = createWheelController({ navigate, isExcluded: excluded, isTransitioning: transitioning });
    return { navigate, c };
  }

  it("1ジェスチャーで最大1ページ。慣性入力が続く間は2ページ目へ進まない", () => {
    const { navigate, c } = setup();
    for (let i = 0; i < 30; i++) {
      c.handle(ev(50));
      vi.advanceTimersByTime(50); // 180ms 未満の間隔で入力が続く
    }
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("180ms 入力が途切れると idle に戻り、次のジェスチャーで移動できる", () => {
    const { navigate, c } = setup();
    c.handle(ev(150));
    vi.advanceTimersByTime(181);
    expect(c.getState().phase).toBe("idle");
    c.handle(ev(150));
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("アニメーション中の入力は移動に使わないが、終了タイマーは延長する", () => {
    let transitioning = false;
    const { navigate, c } = setup(() => transitioning);
    c.handle(ev(150)); // 移動 → latched
    transitioning = true;
    // 200ms のアニメーション中、100ms 間隔で慣性入力が続く
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(100);
      c.handle(ev(30));
    }
    transitioning = false;
    expect(c.getState().phase).toBe("latched"); // idle へ戻っていない
    vi.advanceTimersByTime(100);
    c.handle(ev(150)); // アニメーション終了後の慣性入力
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("除外条件では preventDefault もタイマー延長もしない", () => {
    const { navigate, c } = setup(
      () => false,
      () => true,
    );
    const e = ev(500);
    c.handle(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("Ctrl/Cmd + ホイールではページ送りも preventDefault もしない", () => {
    const { navigate, c } = setup();
    const e1 = ev(500, { ctrlKey: true });
    const e2 = ev(500, { metaKey: true });
    c.handle(e1);
    c.handle(e2);
    expect(navigate).not.toHaveBeenCalled();
    expect(e1.preventDefault).not.toHaveBeenCalled();
    expect(e2.preventDefault).not.toHaveBeenCalled();
  });
});
