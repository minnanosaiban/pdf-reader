import { describe, expect, it } from "vitest";
import { computeDocumentId } from "./documentId";

describe("computeDocumentId", () => {
  it("内容が同じなら、ファイル名が違っても同じID", async () => {
    const a = new File([new Uint8Array([1, 2, 3])], "a.pdf");
    const b = new File([new Uint8Array([1, 2, 3])], "b.pdf");
    expect(await computeDocumentId(a)).toBe(await computeDocumentId(b));
    expect(await computeDocumentId(a)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
  it("1バイトでも違えば別のID", async () => {
    const a = new Blob([new Uint8Array([1, 2, 3])]);
    const b = new Blob([new Uint8Array([1, 2, 4])]);
    expect(await computeDocumentId(a)).not.toBe(await computeDocumentId(b));
  });
  it("50MB超は部分ハッシュ（sha256-partial:）になる", async () => {
    const big = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)]);
    expect(await computeDocumentId(big)).toMatch(/^sha256-partial:[0-9a-f]{64}$/);
  });
});
