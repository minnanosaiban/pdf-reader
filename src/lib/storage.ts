import type { Annotation, AppSettings, DocumentViewState } from "./types";

const DB_NAME = "two-page-pdf-reader";
const DB_VERSION = 1;

export interface SavedDocument {
  annotations: Annotation[];
  viewState: DocumentViewState;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("docs");
      db.createObjectStore("settings");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(store: "docs" | "settings", key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put(store: "docs" | "settings", key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const loadDocument = (id: string) => get<SavedDocument>("docs", id);
export const saveDocument = (id: string, doc: SavedDocument) => put("docs", id, doc);
export const loadSettings = () => get<AppSettings>("settings", "global");
export const saveSettings = (s: AppSettings) => put("settings", "global", s);
