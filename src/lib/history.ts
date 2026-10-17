import type { Annotation, TextAnnotation } from "./types";

export interface History {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
}

export const emptyHistory: History = { past: [], present: [], future: [] };

export type HistoryAction =
  | { type: "load"; annotations: Annotation[] }
  | { type: "add"; annotation: Annotation }
  | { type: "remove"; id: string }
  | { type: "editText"; id: string; patch: Pick<TextAnnotation, "text" | "x" | "y" | "w" | "h"> }
  | { type: "undo" }
  | { type: "redo" };

const commit = (h: History, next: Annotation[]): History => ({
  past: [...h.past, h.present],
  present: next,
  future: [],
});

/** 第47.3節：追加・削除・テキスト変更をUndo/Redoの対象にする。倍率・配置は含めない。 */
export function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "load":
      return { past: [], present: a.annotations, future: [] };
    case "add":
      return commit(h, [...h.present, a.annotation]);
    case "remove":
      if (!h.present.some((x) => x.id === a.id)) return h;
      return commit(
        h,
        h.present.filter((x) => x.id !== a.id),
      );
    case "editText": {
      const target = h.present.find((x) => x.id === a.id);
      if (!target || target.type !== "text") return h;
      return commit(
        h,
        h.present.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)),
      );
    }
    case "undo": {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    }
    case "redo": {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    }
  }
}
