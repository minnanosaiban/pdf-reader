const FULL_HASH_LIMIT = 50 * 1024 * 1024;
const EDGE = 1024 * 1024;

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function canHash(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

/** 第50節：内容ハッシュで文書を識別する。ファイル名・更新日時は含めない。 */
export async function computeDocumentId(file: Blob): Promise<string> {
  if (file.size <= FULL_HASH_LIMIT) {
    return "sha256:" + toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  }
  const head = new Uint8Array(await file.slice(0, EDGE).arrayBuffer());
  const tail = new Uint8Array(await file.slice(file.size - EDGE).arrayBuffer());
  const sizeBytes = new TextEncoder().encode(String(file.size));
  const all = new Uint8Array(sizeBytes.length + head.length + tail.length);
  all.set(sizeBytes, 0);
  all.set(head, sizeBytes.length);
  all.set(tail, sizeBytes.length + head.length);
  return "sha256-partial:" + toHex(await crypto.subtle.digest("SHA-256", all));
}
