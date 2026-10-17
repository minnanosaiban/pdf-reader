# CLAUDE.md — 連続2ページPDFリーダー

詳細な要件は `pdf_reader_implementation_spec_v1.7.md`（リポジトリ直下）を正とします。矛盾する場合は仕様書を優先します。

## 作業の進め方

- 作業開始時に仕様書を読む。第62節「今回実装しない機能」に該当するものは、便利に見えても実装しない
- 仕様にない機能を独自判断で足さない。判断した場合は README の「実装上の判断」に1行で記録する
- 公開（デプロイ）は利用者の指示があるまで行わない

## 技術スタック

React + TypeScript + Vite + PDF.js（pdfjs-dist）。テストは vitest。

## 守ること

- 倍率に CSS `transform: scale()` を使わない。PDF.js の描画サイズ自体を再計算する（第11B節）
- Annotation 座標は正規化座標（0〜1）。ページ外の点を `clamp` で押し込まない（第11D・44節）
- PDF.js TextLayer は使わない
- 判断ロジックは DOM から切り離した純粋関数にし、単体テストを書く
- 変更後は `npm run typecheck` と `npm test` を通す
