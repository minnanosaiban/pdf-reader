import { describe, expect, it } from "vitest";
import { emptyHistory, historyReducer, type History } from "./history";
import { sanitizeViewState, type TextAnnotation } from "./types";

const t: TextAnnotation = {
  id: "t1",
  type: "text",
  pageNumber: 1,
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.05,
  text: "abc",
  sizeRatio: 0.028,
};

describe("historyReducer", () => {
  it("追加・削除・テキスト編集を取り消し／やり直しできる", () => {
    let h: History = historyReducer(emptyHistory, { type: "add", annotation: t });
    h = historyReducer(h, { type: "editText", id: "t1", patch: { text: "xyz", x: 0.1, y: 0.1, w: 0.3, h: 0.05 } });
    expect((h.present[0] as TextAnnotation).text).toBe("xyz");
    h = historyReducer(h, { type: "undo" });
    expect((h.present[0] as TextAnnotation).text).toBe("abc"); // 再編集は1回の操作
    h = historyReducer(h, { type: "redo" });
    expect((h.present[0] as TextAnnotation).text).toBe("xyz");
    h = historyReducer(h, { type: "remove", id: "t1" });
    expect(h.present).toHaveLength(0);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toHaveLength(1);
  });
  it("新しい操作で redo 履歴が消える", () => {
    let h = historyReducer(emptyHistory, { type: "add", annotation: t });
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "add", annotation: { ...t, id: "t2" } });
    expect(h.future).toHaveLength(0);
  });
});

describe("sanitizeViewState", () => {
  it("不正な値は初期値へ戻す", () => {
    expect(sanitizeViewState({ scalePercent: 70, placement: "x", currentPage: -3 }, 10)).toEqual({
      currentPage: 1,
      scalePercent: 100,
      placement: "center",
    });
    expect(sanitizeViewState(null, 10).currentPage).toBe(1);
  });
  it("正しい値は維持し、ページは範囲内へ収める", () => {
    expect(sanitizeViewState({ scalePercent: 80, placement: "top-left", currentPage: 99 }, 10)).toEqual({
      currentPage: 10,
      scalePercent: 80,
      placement: "top-left",
    });
  });
});
