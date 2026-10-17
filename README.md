# 連続2ページPDFリーダー

連続する任意の2ページ（Page 3 | Page 4 → Page 4 | Page 5 …）を同時に大きく表示して読み、蛍光マーカー・ライン・手書き風文字を書き込めるPDFリーダーです。処理はすべてブラウザ内で完結し、外部送信はありません。

仕様は [`pdf_reader_implementation_spec_v1.7.md`](pdf_reader_implementation_spec_v1.7.md) を正とします。

## 動かし方

```
npm install
npm run dev        # http://localhost:5173/
npm test           # 単体テスト（vitest）
npm run build      # 型チェック + ビルド（dist/）
```

## 操作

| 操作 | 内容 |
|---|---|
| 左右キー / ホイール | 1ページずつ移動（ホイールは1ジェスチャーにつき最大1ページ） |
| Ctrl/Cmd + G | ページ指定（8 を指定すると Page 8 \| Page 9） |
| 閲覧ツールでクリック | ストローク・テキストを選択。Delete で削除、ダブルクリック / Enter でテキスト再編集 |
| 表示ボタン | 倍率（フィット / 90％ / 80％）と配置（中央 / 左上 / 上中央） |
| Ctrl/Cmd + Z、Shift + Z（Ctrl + Y） | 取り消し・やり直し |

PDFはファイル選択（初期画面・設定パネル）またはドラッグ＆ドロップで開きます。

## 構成

```
src/
  lib/          純粋関数（layout・wheel・hitTest・stroke・history・documentId）と、描画・保存
  hooks/        useSpreadLayout / useWheelNavigation / usePageRatios
  components/   ToolPalette / SpreadView / PDFPage（PDFCanvas・PageAnnotationLayer・InteractionLayer）
                ViewDisplayPopover / SettingsPanel / PageJumpInput
  App.tsx       状態管理とキーボード・保存の接続
```

判断ロジック（レイアウト計算・ホイールの状態遷移・当たり判定・ストロークのページ境界処理・履歴・documentId）は、DOM から切り離した純粋関数として実装し、`*.test.ts` で検証しています。

## 実装上の判断（仕様書に記載のない点）

- ツールバーの設定の項目のうち「印・図形表示」「付箋表示」「将来のホイール感度」は、対応する機能が仕様にないため設けていない（設定は筆記具の色とモーション軽減のみ）
- ページ番号表示（`8 / 126`）は、ツールバー下端の小さなボタン。押すとページ指定が開く
- PDFを開くボタンは、初期画面と設定パネルの「別のPDFを開く」に置いた
- 手書き風フォントは Yomogi を `@fontsource/yomogi` で同梱（外部のフォント配信は使わない）
- テキストの確定は、入力欄の外クリック・Escape・表示ボタン。Enter は改行
- 描画中ストロークの表示は、InteractionLayer 内の専用 Canvas に描く

## 既知の制約

- PDFを編集・再保存すると内容ハッシュが変わるため、以前のAnnotationは復元されない（documentId は内容のSHA-256）
- 50MBを超えるPDFは、サイズ＋先頭1MB＋末尾1MBの部分ハッシュで識別する。まれに別のPDFを同一と誤認する可能性がある
- IndexedDB と `crypto.subtle` が使えない環境（HTTP の非 localhost など）では、保存と復元は利用できない
- PDF.js の TextLayer は使わないため、本文の文字選択・コピーはできない
