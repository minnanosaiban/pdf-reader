# 連続2ページPDFリーダー 実装指示書 v1.7

## 0. この指示書の優先順位

- 連続するPDF2ページを可能な限り大きく表示（初期状態）
- ホイールと左右キーで1ページずつ確実に移動
- Annotationを正しいページ位置へ保持
- PDF本文をUIで遮らない
- 紙の筆記具に近い書き味
- 不要な機能を増やさない

縮小表示（90％・80％）は、利用者が明示的に選んだ場合だけ適用する。初期状態はフィット（100％）とし、「可能な限り大きく表示」の原則と矛盾させない。

## 1. アプリの目的

紙の資料を2ページ並べて読み、蛍光マーカー、ライン、手書き風文字を書き込めるPDFリーダー。

## 2. アプリの位置付け

Adobe Acrobatの簡易版やフリップブックではなく、隣接する任意の2ページを同時に読む連続2ページビュー。

## 3. 変更履歴

### 3.1 ページ遷移表現（v1.3）

本のページカールではなく、控えめなスライド／クロスフェードとする（第21節）。

### 3.2 ホイール入力（v1.3）

1回の連続したホイールジェスチャーにつき最大1ページ移動とする（第23～35節）。

### 3.3 手書き風文字の定義（v1.3）

キーボード入力＋手書き風フォントによるテキストAnnotationとする（第39節）。

### 3.4 PDFサイズ（v1.3）

A4固定にはせず、PDF.jsから実ページ比率を取得する（第10～13節）。

### 3.5 表示倍率とPDF配置（v1.4）

PDF2ページを90％・80％へ縮小し、中央・左上・上中央に配置できるようにする（第11A～11D節、第16A節、第52A節）。

### 3.6 v1.4レビュー反映（v1.5）

- ページ外へ出たストロークは「ページ境界で線を終了する」方式に統一（11D・44）
- PDF.js TextLayerは採用しない。各レイヤーの役割を定義（11B・45）
- 文字入力中に表示ボタンを押した場合は入力を自動確定（41）
- PDF Workspaceの範囲とレイアウト変数を定義（11・14）
- サイズが異なるページの高さ基準を定義（12）
- pointer capture、遷移中の描画禁止、再描画条件、Canvas上限、ポップオーバー位置、ARIA、ツールバー上のホイールを明記

### 3.7 v1.5レビュー反映（v1.6）

- Annotationの選択・再編集の操作方法を定義（11B・45・47・48）
- ホイール処理の状態遷移と擬似コードを定義。latched中の方向反転の扱いを明記（24～35）
- documentIdの生成方法を定義（50）

### 3.8 v1.6レビュー反映（v1.7）

- ページ遷移アニメーション中のホイール入力は、ページ移動・累積には使わないが、ジェスチャー終了タイマーは延長する（30・32・35）。慣性スクロールでの2ページ移動を防ぐため
- Annotationの選択は、要素ごとのクリック受付ではなく、PDFPageでクリックを受けて座標で当たり判定する方式に変更（11B・47）。PageAnnotationLayerの描画方式（SVG / Canvas）に依存しないようにするため

## 4. 技術構成

React + TypeScript + Vite + PDF.jsを基本構成とする。

## 5. 責務の分離

PDF読み込み、描画、ナビゲーション、表示倍率・配置、Annotation、保存、設定を分離する。

## 6. PDFの読み込み

ローカルPDFをファイル選択またはドラッグ＆ドロップで読み込む。

## 7. PDF表示の基本仕様

```text
Page 1 | Page 2
Page 2 | Page 3
Page 3 | Page 4
Page 4 | Page 5
```

常に1ページ単位でずらす。

## 8. currentPage

currentPageは左側ページ番号。

## 9. ページ境界

最後は `Page 10 | 空白` を許容。

## 10. ページサイズと比率

A4固定にはせずPDF.jsから実ページ比率を取得。

## 11. サイズ決定

2ページを縦方向いっぱいに近い大きさで表示する。縦幅基準で拡大し、横幅が足りない場合だけ縮小する。

### 11.1 PDF Workspaceの範囲

PDF Workspaceは、アプリ画面全体から左側ツールバー領域（幅 `--toolbar-width`）を除いた領域とする。設定パネル表示中は、設定パネルの幅も除く。

- サイズ計算と配置計算はすべてPDF Workspaceを基準にする。
- ツールバーはWorkspaceの外にあるため、どの倍率・配置でもPDFと重ならない。

### 11.2 レイアウト変数

```css
:root {
  --toolbar-width: 56px;                     /* 40pxボタン + 左右8px */
  --page-margin-y: clamp(8px, 1.1vh, 24px);  /* 上下の最小余白 */
  --page-margin-x: clamp(8px, 1.1vw, 24px);  /* 左右の最小余白 */
  --page-gap: clamp(4px, 0.4vw, 12px);       /* 左右ページ間隔 */
}
```

### 11.3 フィットサイズ（fitSize）の計算

```text
availableWidth  = workspaceWidth  - 2 × pageMarginX
availableHeight = workspaceHeight - 2 × pageMarginY

pageHeight = availableHeight
spreadWidth = pageHeight × (左ページ幅/高さ比 + 右ページ幅/高さ比) + pageGap

spreadWidth > availableWidth の場合のみ、
spreadWidth = availableWidth となるまで pageHeight を縮小する
```

この結果をfitSizeと呼び、表示倍率100％の基準とする。

## 11A. 表示倍率

MVPで選択可能な倍率は以下の3段階とする。

| 表示名 | scalePercent | 内容 |
|---|---|---|
| フィット | 100 | fitSizeをそのまま使用（初期値） |
| 90％ | 90 | fitSize × 0.9 |
| 80％ | 80 | fitSize × 0.8 |

```typescript
type ScalePercent = 100 | 90 | 80;

const renderedPageHeight = fitPageHeight * (scalePercent / 100);
const renderedPageGap    = pageGap; // 間隔は倍率で変えない
```

ルール：

- 倍率の基準はPDF実寸ではなく、常にfitSizeとする。
- 「自動」と「100％」は同じ意味になるため、別項目として設けない。
- WorkspaceサイズやfitSizeが変わった場合は、fitSizeを再計算してから倍率を適用する。
- 100％を超える拡大は実装しない（第62節）。
- 倍率はブラウザ全体のズームではなく、PDFページとその上のレイヤーだけに適用する。
- ツールバー、設定パネル、ページ番号表示などのUIサイズは変更しない。
- 倍率を変更してもcurrentPageは変更しない。
- 倍率変更時はページ遷移アニメーション（第21節）を発生させない。

## 11B. 描画方法とレイヤー

倍率の適用にCSS `transform: scale()` を使用しない。PDF.jsの描画サイズそのものを倍率に合わせて再計算する。

理由：

- transformで縮小すると、ポインター座標とAnnotation座標の変換が複雑になる。
- 当たり判定、選択枠、テキスト入力位置がずれやすくなる。
- 縮小後の文字がぼやけることがある。

描画ルール：

- Canvasの内部解像度は `表示サイズ × devicePixelRatio` とする。
- Canvasの内部ピクセル数は1ページあたり最大16,777,216（4096×4096相当）とする。超える場合は使用するdevicePixelRatioを下げる。
- 倍率変更時は現在表示中の2ページを最優先で再描画する。
- 連続した倍率変更やリサイズによる再描画は、最後の操作だけを反映するよう間引く。
- PDF.jsの描画タスクは、新しい描画を始める前に古いタスクをキャンセルする。

ページごとのレイヤー：

```text
PDFPage
├─ PDFCanvas            PDF.jsによるページ描画のみ
├─ PageAnnotationLayer  保存済みAnnotationの表示
└─ InteractionLayer     ポインター入力の受付と描画中ストロークの表示
```

- 3層は同じページ表示サイズで同時に更新する。
- PDF.jsのTextLayer（本文の文字選択）は実装しない（第62節）。
- InteractionLayerは、閲覧ツール選択時は `pointer-events: none` とし、筆記具選択時だけ入力を受け付ける。
- PageAnnotationLayerは、ツールにかかわらず常に `pointer-events: none` とする。PageAnnotationLayerは表示専用とし、SVG・Canvasのどちらで描画してもよい。
- 閲覧ツール選択時のAnnotationの選択は、PDFPage要素でクリックを受け取り、クリック位置とAnnotationデータを座標で照合して判定する（第47節）。DOM要素ごとのクリック判定には依存しない。

## 11C. PDF配置

| 表示名 | placement | 内容 |
|---|---|---|
| 中央 | `center` | 上下左右とも中央（初期値） |
| 左上 | `top-left` | Workspaceの左上へ配置 |
| 上中央 | `top-center` | 上端に配置し、左右は中央 |

ルール：

- 配置の基準はPDF Workspaceとする（第11.1節）。
- どの配置でも、上下左右に第11.2節の最小余白を確保する。
- 左右2ページの間隔は倍率・配置にかかわらず `--page-gap` とする。
- 配置を変更してもcurrentPageとAnnotationは変更しない。
- ページを移動しても選択した倍率と配置を維持する。
- 100％（フィット）表示では、配置の違いがほぼ見えなくてもよい。

```css
.app {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.tool-palette {
  flex: 0 0 var(--toolbar-width);
}

.pdf-workspace {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  overflow: hidden;
  box-sizing: border-box;
  padding: var(--page-margin-y) var(--page-margin-x);
}

.pdf-workspace[data-placement="center"] {
  justify-content: center;
  align-items: center;
}

.pdf-workspace[data-placement="top-left"] {
  justify-content: flex-start;
  align-items: flex-start;
}

.pdf-workspace[data-placement="top-center"] {
  justify-content: center;
  align-items: flex-start;
}

.pdf-spread {
  display: flex;
  gap: var(--page-gap);
}

.pdf-page {
  position: relative;
}

.pdf-page canvas,
.pdf-page .annotation-layer,
.pdf-page .interaction-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

## 11D. 縮小時の余白とAnnotationの関係

Annotationを保存できる範囲はPDFページ内だけとする。

縮小でできたPDF外の余白は、以下の用途に使う。

- ペンやマウスを動かすための操作スペース
- ページ端付近へ書き込むときの見やすさの確保
- 視覚的な圧迫感の軽減

ストロークのルール：

- PDF外の余白からは描画を開始しない。
- 描画開始時に `setPointerCapture(pointerId)` を呼び、ポインターがページ外へ出ても入力を受け取り続ける。
- ストロークがページ外へ出た場合は、直前の点とページ外の点を結ぶ線分とページ境界との交点を最後の点として追加し、その時点でストロークを終了・確定する。
- ページ外の点をページ端へ押し込んで保存してはならない（ページ端に沿った線が残るため）。
- 一度終了したストロークは、ポインターがページ内へ戻っても再開しない。続けて描くにはポインターを離して描き直す。
- 左ページから右ページへまたがるストロークは作らない。描き始めたページの境界で終了する。

手書き風文字のルール：

- 入力位置とテキストボックスは、ページ内へ収まるよう位置を補正する。

ホイールのルール：

- PDF外の余白でのホイール操作も、Workspace内の操作としてページ送りに使う（第23節）。

PDF外の余白への書き込み、ページ横の専用メモ欄、メモ欄のMarkdown保存は実装しない（第62節）。

## 12. サイズが異なるページ

- 左右2ページは表示高さをそろえる。幅は各ページの縦横比から決める。
- 縦向きと横向きが並ぶ場合も表示高さをそろえ、合計幅がWorkspaceを超える場合は第11.3節の計算で全体を縮小する。
- 右側が空白（最終ページ）の場合は、左ページと同じ大きさの空白領域を確保し、左ページの表示位置を変えない。
- 表示倍率を変更しても同じ扱いを維持する。

## 13. 1920×1080のA4基準例

上下約12pxを目安とする。ただし固定値にはしない。

参考（フィット時のページ高さを約1056pxとした場合）：

| 倍率 | ページ表示高さの目安 |
|---|---|
| 100％ | 約1056px |
| 90％ | 約950px |
| 80％ | 約845px |

数値は目安であり、実装では必ず第11.3節・第11A節の計算で求める。

## 14. UI配置

- 左端：ツールバー領域（`--toolbar-width`）
- 残りの領域：PDF Workspace（PDF2ページと上下左右の余白）
- 設定時のみ右側に設定パネル。表示中はWorkspaceが狭くなるため、fitSizeを再計算する。

## 15. PDF上へ常設しないもの

矢印、ツールバー、設定、サムネイル、ヘッダー等をPDFへ重ねない。

表示ボタンのポップオーバー（第16A節）は一時表示であり、常設しない。

## 16. 標準ツールバー

- 閲覧
- 黄色系マーカー
- ピンク系マーカー
- 赤ライン
- 青ライン
- 手書き風文字
- 表示
- 設定

## 16A. 表示ボタン

押すと、ポップオーバーを開く。

```text
表示倍率
[フィット] [90％] [80％]

配置
[中央] [左上] [上中央]
```

ルール：

- ボタンは第17節と同じく40×40px、アイコンのみとする。
- 倍率が100％以外のときは、ボタンのアイコンを強調表示し、縮小中であることが分かるようにする。
- ポップオーバー内の項目は即時反映する（適用ボタンは設けない）。
- ポップオーバーはEscape、外側クリック、表示ボタンの再クリックで閉じる。
- ポップオーバーは表示ボタンの右横に、ボタンの上端にそろえて表示する。PDFに重なってもよいが、一時表示に限る。
- 画面下端からはみ出す場合は上方向へずらす。
- ポップオーバーを開いてもactiveToolは変更しない（第42節）。
- 文字入力中・描画中の扱いは第41節に従う。

## 17. ボタン仕様

40×40pxを基本とし、文字ラベルは常設しない。

## 18. ページ移動方法

すべて共通関数へ接続。

```typescript
navigateNextPage();
navigatePreviousPage();
goToPage(pageNumber);
```

## 19. キーボード操作

- ArrowRight：次
- ArrowLeft：前
- Ctrl/Cmd + G：ページ指定
- Escape：入力・ポップオーバー等を閉じる

表示倍率にはキーボードショートカットを割り当てない。`Ctrl/Cmd + +`、`Ctrl/Cmd + -`、`Ctrl/Cmd + 0` はブラウザズームと競合するため、アプリ側で処理しない。

## 20. ページ番号指定

`8 / 126` のように表示し、8指定なら `Page 8 | Page 9`。

## 21. ページ遷移表現

本のページカールではなく160～220ms程度の控えめなスライド／クロスフェード。

- 倍率・配置の変更時には遷移アニメーションを使わない。
- 遷移アニメーション中は筆記具による描画を開始させない。アニメーション完了後に入力を再開する。

## 22. ページ再利用

`Page 3 | Page 4` → `Page 4 | Page 5` では、可能ならPage 4を再利用。

ページ描画のキャッシュキーは `pageNumber + 表示サイズ + 使用したdevicePixelRatio` とする。倍率やWorkspaceサイズが変わった場合はキーが一致しないため再利用せず、現在の表示サイズで描き直す。

## 23. ホイール入力の基本方針

1回の連続したホイールジェスチャーにつき最大1ページ。

PDF外の余白を含むPDF Workspace全体をホイール受付範囲とする。ツールバーと設定パネルは受付範囲に含めない。

## 24. ホイール状態モデル

```typescript
type WheelGestureState = "idle" | "collecting" | "latched";
```

## 25. ホイール初期パラメーター

```typescript
const WHEEL_THRESHOLD_PX = 100;
const WHEEL_GESTURE_END_MS = 180;
const LINE_HEIGHT_PX = 16;
```

## 26. ホイール処理順

除外判定 → 正規化 → 累積 → 閾値判定 → 1ページ移動 → latched。

## 27. deltaMode正規化

PIXEL / LINE / PAGEをピクセル相当に統一。

## 28. 入力方向

`deltaY > 0` で次ページ、`deltaY < 0` で前ページ。

## 29. 累積値

```typescript
wheelAccumulator += normalizedDeltaY;
```

方向反転時の扱いは状態によって異なる。

| 状態 | 方向反転時 |
|---|---|
| `collecting` | 累積値をリセットし、新しい方向で累積を始め直す |
| `latched` | **無視する**。累積もページ移動もしない。ジェスチャー終了（第30節）まで待つ |

`latched` 中の方向反転を無視するのは、トラックパッドの慣性スクロールの揺り戻しや、ホイールの戻し操作で、直前の移動と逆向きにもう1ページ動いてしまうのを防ぐため。

## 30. ジェスチャー終了

入力が `WHEEL_GESTURE_END_MS`（180ms）途切れたら `idle` へ復帰し、累積値を0にする。

- `latched` 中もホイール入力が続く限り、ジェスチャー終了のタイマーを延長し続ける（慣性スクロールが続いている間は次のページ移動をしない）
- 除外条件（第32節）に該当する入力は、累積にもタイマーの延長にも使わない。**ただし、ページ遷移アニメーション中の入力は例外とし、累積・ページ移動には使わないが、タイマーは延長する**
  - 理由：アニメーション（160～220ms）がジェスチャー終了時間（180ms）より長いため、アニメーション中の入力でタイマーを延長しないと、慣性スクロールが続いている途中で `idle` に戻り、アニメーション終了後の慣性入力で2ページ目へ移動してしまう

## 31. 境界でのホイール

先頭・末尾ではページを移動せず、無駄なアニメーションもしない。

## 32. ホイール除外条件

以下の場合はページ送りに使わない。

- 入力欄、設定パネル、ダイアログ、表示ポップオーバー、ツールバー上
- テキスト編集中、Annotation操作中、ストローク描画中
- ページ遷移アニメーション中（ジェスチャー終了タイマーの延長だけは行う。第30節）
- `ctrlKey` または `metaKey` が押されている（ブラウザズーム、トラックパッドのピンチ操作）

## 33. preventDefault

Workspaceでページ送りするときだけ抑制。Ctrl/Cmd + ホイールは抑制しない。

## 34. ホイール用hook

`useWheelNavigation`

## 35. ホイール実装の擬似コード

状態遷移：

```text
idle ──(入力あり)──▶ collecting ──(累積が閾値以上)──▶ latched
  ▲                     │                               │
  └──(180ms入力なし)────┴───────(180ms入力なし)─────────┘
```

擬似コード：

```typescript
type WheelGestureState = "idle" | "collecting" | "latched";

let state: WheelGestureState = "idle";
let accumulator = 0;
let endTimer: number | null = null;

function onWheel(event: WheelEvent) {
  // 1. 除外判定（第32節。ページ遷移アニメーション中は含めない）
  if (isExcluded(event)) return; // preventDefault もしない

  // 2. 正規化（第27節）
  const delta = normalizeDeltaY(event); // PIXEL / LINE / PAGE → px
  if (delta === 0) return;

  // Workspace でページ送りに使う入力なので、スクロールを抑制（第33節）
  event.preventDefault();

  // 3. ジェスチャー終了タイマーを延長（第30節）
  restartEndTimer();

  // 3a. ページ遷移アニメーション中は、タイマー延長だけ行い、累積・移動はしない
  if (isPageTransitionRunning()) return;

  // 4. latched 中は方向にかかわらず何もしない（第29節）
  if (state === "latched") return;

  // 5. 累積（方向反転時はリセット）
  if (state === "collecting" && Math.sign(delta) !== Math.sign(accumulator)) {
    accumulator = 0;
  }
  state = "collecting";
  accumulator += delta;

  // 6. 閾値判定
  if (Math.abs(accumulator) < WHEEL_THRESHOLD_PX) return;

  // 7. 1ページ移動（境界では移動しない。第31節）
  if (accumulator > 0) navigateNextPage();
  else navigatePreviousPage();

  // 8. latched へ移行
  state = "latched";
  accumulator = 0;
}

function restartEndTimer() {
  if (endTimer !== null) clearTimeout(endTimer);
  endTimer = window.setTimeout(() => {
    state = "idle";
    accumulator = 0;
    endTimer = null;
  }, WHEEL_GESTURE_END_MS);
}
```

補足：

- `wheel` イベントのリスナーは `{ passive: false }` で登録する（`preventDefault()` を有効にするため）
- `isExcluded()` には、ページ遷移アニメーション中かどうかの判定を含めない（3aで別に扱う）
- 先頭・末尾で移動できない場合も `latched` へ移行する（境界で入力を続けても、ジェスチャー中に何度も判定しないため）
- 状態とタイマーは `useRef` で保持し、ホイールのたびに再レンダリングしない
- アンマウント時にタイマーを解除する
- 上記の判定部分は、イベントやタイマーから切り離した純粋関数として実装し、単体テストの対象にする

## 36. 標準筆記具

- 黄色マーカー
- ピンクマーカー
- 赤ライン
- 青ライン

## 37. 蛍光マーカーの表現

半透明でわずかな濃淡・揺れを持つ。完全な長方形にはしない。

## 38. ラインの表現

細く、ほぼ不透明で、微小な手描き感を持つ。

## 39. 手書き風文字

キーボード入力＋手書き風フォントによるテキストAnnotation。

## 40. 手書き風フォント

日本語・英数字に対応し、可読性を優先。

## 41. ツールモードと操作競合

描画中、文字入力中、ページ移動、倍率・配置変更の競合を防止する。

- ストローク描画中（ポインター押下中）は表示ボタンを無効にする。
- 文字入力中に表示ボタンを押した場合は、入力中のテキストを自動確定してからポップオーバーを開く。
- 入力中のテキストが空の場合は確定せず破棄する。
- 自動確定は、Undoで取り消せる通常のテキスト追加として扱う。

## 42. activeTool維持

ページを移動しても、倍率・配置を変更しても、選択中の筆記具を維持。

## 43. 設定パネル

- 4本の筆記具の色
- 印・図形表示
- 付箋表示
- モーション軽減
- 将来のホイール感度設定

表示倍率と配置は表示ボタン（第16A節）で操作し、設定パネルには置かない。

## 44. Annotationデータモデル

`documentId + pageNumber + ページ内正規化座標` を基本にする。正規化座標は表示倍率・配置に依存しない値とする。

```typescript
// 入力時：ポインター座標 → ページローカル座標 → 正規化座標
const rect = pageElement.getBoundingClientRect();
const localX = event.clientX - rect.left;
const localY = event.clientY - rect.top;
const normalizedX = localX / rect.width;
const normalizedY = localY / rect.height;

const isOutside =
  normalizedX < 0 || normalizedX > 1 ||
  normalizedY < 0 || normalizedY > 1;

// isOutside の場合は clamp しない。
// 第11D節に従い、ページ境界との交点を最後の点として追加し、ストロークを終了する。

// 表示時：正規化座標 → 現在の表示座標
const renderedX = normalizedX * renderedPageWidth;
const renderedY = normalizedY * renderedPageHeight;
```

線の太さ、マーカー幅、文字サイズもページ表示サイズに比例して描画する。倍率を変えても、PDF本文に対する相対的な大きさが変わらないようにする。

## 45. Annotation Layer

ページごとに持つ。各層の役割は第11B節に従う。

```text
PDFPage
├─ PDFCanvas
├─ PageAnnotationLayer
└─ InteractionLayer
```

## 46. Annotationの左右移動

Page Nが右から左へ移ってもAnnotation位置を維持。

## 47. Annotationの選択と削除

### 47.1 選択の操作

Annotationの選択は、**閲覧ツール選択時のみ**行える。筆記具選択時にAnnotationの上をクリックした場合は、選択ではなく新しい描画・入力として扱う。

クリックの受け取りと判定：

- 閲覧ツール選択時、PDFPage要素の `pointerdown`（主ボタンのみ）でクリックを受け取る
- クリック位置を第44節と同じ方法でページ内の正規化座標に変換し、そのページのAnnotationデータに対して当たり判定（47.2）を行う
- 該当するAnnotationがあれば選択し、なければ選択を解除する
- PDF外の余白（PDF Workspace内でPDFPageの外）をクリックした場合も、選択を解除する
- ダブルクリックによるテキスト再編集（第48節）も同じ当たり判定で対象を決める

| 操作 | 動作 |
|---|---|
| 閲覧ツールでAnnotationをクリック | そのAnnotationを選択する（選択枠を表示） |
| 閲覧ツールでAnnotationのない場所をクリック | 選択を解除する |
| 別のAnnotationをクリック | 選択を切り替える（複数選択はしない） |
| Delete / Backspace | 選択中のAnnotationを削除する |
| Escape | 選択を解除する |
| 筆記具に切り替える | 選択を解除する |
| ページを移動する | 移動後に表示されないページのAnnotationが選択中なら、選択を解除する |

### 47.2 当たり判定

当たり判定は、DOMやイベントから切り離した純粋関数として実装し、単体テストの対象にする。

```typescript
// クリック位置（ページ内の正規化座標）と表示サイズから、選択するAnnotationのIDを返す
function hitTestAnnotations(
  annotations: Annotation[],     // そのページのAnnotation（作成順）
  point: { x: number; y: number }, // 正規化座標
  renderedPageSize: { width: number; height: number },
): string | null;
```

- 距離の計算は、正規化座標を表示サイズのpxに戻してから行う（判定の許容幅を表示上のpxで一定にするため）

- ストローク：クリック位置からストロークの各線分までの最短距離を求め、その距離が許容幅（目安：表示上の線幅の半分＋4px）以内なら選択する。ストロークを囲む矩形全体を当たり判定にしない（大きな丸で囲んだ線の内側をクリックしても選択されないようにする）
- テキスト：テキストボックスの矩形内をクリックしたときに選択する
- 重なっている場合は、後から作成したAnnotationを優先する

### 47.3 Undo / Redo

- Annotationの追加・削除・テキストの変更をUndo/Redoの対象とする
- 倍率・配置の変更はUndo/Redoの対象にしない
- Undo / Redo のキーボード操作：Ctrl/Cmd + Z、Ctrl/Cmd + Shift + Z（Windowsでは Ctrl + Y も可）
- テキスト入力中は、Undo / Redo のキー操作を入力欄の文字の取り消しとして扱い、Annotationの履歴には適用しない

## 48. Annotation編集

MVPではテキスト再編集、削除、Undo/Redoまで。

テキストの再編集：

- 閲覧ツールでテキストAnnotationをダブルクリックすると、編集状態になる。選択中のテキストAnnotationで Enter を押した場合も編集状態にする
- 編集状態では第41節の文字入力中と同じ扱いとする（ページ送り・ホイールを無効にする）
- 編集の確定：入力欄の外をクリック、またはEscape。確定時に内容が変わっていれば、1回のUndo操作として記録する
- 編集後の内容が空の場合は、そのテキストAnnotationを削除する（Undoで元に戻せる）
- ストロークの移動・変形・色変更は実装しない

## 49. 保存方針

PDF原本とAnnotationデータを分離。

## 50. documentId

ファイル名だけで識別しない。PDFファイルの内容から算出したハッシュ値で識別する。

生成方法：

- Web Crypto API（`crypto.subtle.digest("SHA-256", ...)`）で算出し、16進文字列にする
- ファイルサイズが50MB以下：ファイル全体のSHA-256を `documentId` とする
- ファイルサイズが50MBを超える：次を連結したバイト列のSHA-256を `documentId` とする（全体を読み込むと時間とメモリを消費するため）
  - ファイルサイズ（バイト数を10進数の文字列にしたもの）
  - 先頭1MB
  - 末尾1MB
- 形式：`sha256:<16進文字列>`（全体）、`sha256-partial:<16進文字列>`（部分）。方式を変更した場合に区別できるようにする

ルール：

- ファイル名、更新日時は `documentId` に含めない（同じPDFをリネーム・コピーしても同じAnnotationを復元するため）
- 内容が1バイトでも違うPDFは別の文書として扱う。PDFを編集・再保存した場合、以前のAnnotationは復元されない（README の既知の制約に記載する）
- 部分ハッシュの場合、先頭・末尾1MBとサイズが一致する別のPDFを同じ文書と誤認する可能性がある。実用上はまれなため許容する
- ハッシュの算出中は読み込み中の表示を出し、算出完了後に表示状態とAnnotationを復元する
- `crypto.subtle` は安全なコンテキスト（HTTPS または localhost）でのみ利用できる。利用できない環境では、PDFを開いたうえで「保存と復元は利用できません」と表示する

## 51. 自動保存

```typescript
const AUTOSAVE_DEBOUNCE_MS = 500;
```

IndexedDBへの自動保存を基本とする。

## 52. 読み込み時の復元

同じPDFならAnnotation、設定、currentPage、表示状態を復元。

## 52A. 表示状態の保存と復元

```typescript
type PagePlacement = "center" | "top-left" | "top-center";

interface DocumentViewState {
  currentPage: number;
  scalePercent: 100 | 90 | 80;
  placement: PagePlacement;
}
```

ルール：

- 倍率と配置は全PDF共通ではなく、PDFごとに保存する。
- 保存するのは倍率（％）と配置だけとし、ピクセル寸法は保存しない。
- 開くたびにWorkspaceサイズからfitSizeを再計算し、保存された倍率を適用する。
- 初めて開くPDFは `scalePercent: 100`、`placement: "center"` とする。
- 保存値が不正な場合は初期値へ戻す。

## 53. PDF原本の扱い

MVPではPDFそのものへ書き込まない。

## 54. アクセシビリティ

aria-label、ツールチップ、キーボードフォーカスを設定。

表示ポップオーバー内の「表示倍率」と「配置」は、それぞれ `role="radiogroup"` とし、各項目を `role="radio"` と `aria-checked` で表す。矢印キーで項目を移動できるようにする。

## 55. ページ移動の通知

スクリーンリーダーへ表示ページを通知。倍率・配置を変更した場合も、変更後の状態（例：「表示倍率 80％、中央」）を通知する。

## 56. パフォーマンス

現在2ページを優先描画し、前後ページのみ先読み。倍率変更時は第11B節に従う。

## 57. レスポンシブ

デスクトップ2ページ表示を最優先。

ウィンドウサイズ変更時、設定パネル開閉時は、fitSize → 倍率 → 配置の順に再計算する。

## 58. 状態管理

Viewer、ViewDisplay（倍率・配置）、ToolSettings、Annotation、WheelGesture等を分離。

## 59. 推奨構成

```text
App
├─ ToolPalette
│  └─ ViewDisplayPopover
├─ PDFWorkspace
│  ├─ SpreadView
│  │  ├─ PDFPage
│  │  │  ├─ PDFCanvas
│  │  │  ├─ PageAnnotationLayer
│  │  │  └─ InteractionLayer
│  │  ├─ PDFPage
│  │  │  ├─ PDFCanvas
│  │  │  ├─ PageAnnotationLayer
│  │  │  └─ InteractionLayer
│  │  └─ PageTransition
│  └─ PageStatusAnnouncer
├─ SettingsPanel
├─ PageJumpInput
├─ hooks
│  ├─ useWheelNavigation
│  └─ useSpreadLayout
├─ stores
│  └─ viewDisplayStore
└─ storage
```

`useSpreadLayout` は、Workspaceサイズ、ページ比率、scalePercent、placementから2ページの表示サイズと位置を算出する。

## 60. MVP実装順序

### Phase 1

PDF読み込み、PDF.js、連続2ページ表示（Workspace範囲、fitSize計算、サイズが異なるページを含む）。

### Phase 2

キーボード、ページ番号、共通ナビゲーション。

### Phase 3

ホイール制御。

### Phase 4

ページ遷移。

### Phase 5

マーカー、ライン、手書き風文字（pointer capture、ページ境界でのストローク終了を含む）。

### Phase 6

Annotation座標、選択（閲覧ツールでのクリック、当たり判定）、削除、テキスト再編集、Undo/Redo。

### Phase 7

表示倍率（フィット・90％・80％）、PDF配置、表示ボタン、縮小時のAnnotation座標確認。

### Phase 8

documentIdの算出、IndexedDB、自動保存、復元（表示状態を含む）。

### Phase 9

設定。

### Phase 10

アクセシビリティ、実機確認、性能調整。

## 61. 完了テスト

### 61.1 PDF表示

- PDFを読み込み、隣接2ページが表示される。
- PDFがツールバーに重ならない。

### 61.2 異なるページサイズ

- サイズや縦横方向が異なるページでも比率が崩れない。
- 左右ページの表示高さがそろう。
- 最終ページで右側の空白があっても、左ページの位置が変わらない。

### 61.3 キーボード

- 左右キーで1ページずつ移動する。
- Ctrl/Cmd + +、-、0 でアプリ側の処理が起きない。

### 61.4 ホイール

- 1ジェスチャーで最大1ページだけ移動する。
- PDF外の余白でもページ送りできる。

### 61.5 方向反転

- `collecting` 中の方向反転で累積値がリセットされる。
- `latched` 中の方向反転は無視され、逆方向へページが移動しない。
- 慣性スクロールが続いている間は、2ページ目の移動が起きない。
- 180ms入力がないと `idle` に戻り、次のジェスチャーで1ページ移動できる。
- 先頭・末尾でホイールを続けても、ページ移動やアニメーションが起きない。

### 61.6 ページ指定

- 8を指定すると `Page 8 | Page 9` になる。

### 61.7 Annotation左右移動

- 右から左へ移ったページのAnnotation位置が維持される。

### 61.8 activeTool

- ページ移動、倍率変更、配置変更後も選択中の筆記具が維持される。

### 61.9 テキスト入力

- 文字入力中に左右キーやホイールでページが動かない。
- 文字入力中に表示ボタンを押すと入力が確定され、Undoで取り消せる。
- 空の入力は確定されない。

### 61.10 保存と復元

- Annotation、設定、currentPage、倍率、配置がPDFごとに復元される。
- ファイル名を変えた同じPDFでも、Annotationが復元される。
- 内容の異なるPDFは、同じファイル名でも別の文書として扱われる。
- 50MBを超えるPDFでも、部分ハッシュで識別され復元される。
- 不正な保存値の場合は初期値で開く。

### 61.11 除外UI

- 入力欄、設定、ダイアログ、表示ポップオーバー、ツールバー上でホイールによるページ送りが起きない。
- Ctrl/Cmd + ホイールでページ送りが起きない。
- ページ遷移アニメーション中にホイールでページが追加移動しない。
- 慣性スクロールがアニメーション時間（220ms）より長く続いても、1ジェスチャーで2ページ目へ移動しない。
- アニメーション中の入力でジェスチャー終了タイマーが延長される（単体テスト。`vi.useFakeTimers()` で確認）。

### 61.12 Undo / Redo

- Annotation操作を取り消し・やり直しできる。
- 倍率・配置変更はUndo/Redoの対象にならない。
- テキスト再編集を1回の操作として取り消せる。
- テキスト入力中の Ctrl/Cmd + Z は入力欄の取り消しになり、Annotationの履歴に影響しない。

### 61.16 Annotationの選択と再編集

- 閲覧ツールでストロークやテキストをクリックすると選択される。
- 筆記具選択時にAnnotationの上をクリックすると、選択ではなく新しい描画になる。
- 大きな丸で囲んだストロークの内側をクリックしても、そのストロークは選択されない。
- Annotationのない場所、およびPDF外の余白をクリックすると選択が解除される。
- 閲覧ツール選択時も、ホイールでのページ送りが妨げられない。
- PageAnnotationLayerをSVG・Canvasのどちらで実装しても、選択の動作が変わらない（当たり判定が描画方式に依存しない）。
- 当たり判定（`hitTestAnnotations`）の単体テスト：線の上・許容幅内・許容幅外、囲み線の内側、テキスト矩形の内外、重なり時の後勝ち、倍率80％と100％で同じ結果になること。
- 選択中に Delete / Backspace で削除でき、Undoで戻せる。
- テキストAnnotationをダブルクリックすると再編集でき、空にして確定すると削除される。
- 筆記具に切り替えると選択が解除される。

### 61.13 表示倍率

- フィット、90％、80％を切り替えられる。
- UI自体は拡大縮小されない。
- PDFの縦横比が変化しない。
- 倍率変更後もcurrentPageが変わらない。
- 倍率変更時にページ遷移アニメーションが出ない。
- 縮小後も文字がぼやけない。
- ウィンドウサイズ変更、設定パネル開閉後も、選択中の倍率がfitSize基準で再計算される。
- 縮小中は表示ボタンが強調表示される。

### 61.14 PDF配置

- 中央、左上、上中央を切り替えられる。
- 左上配置でもPDFがツールバーに重ならず、最小余白が確保される。
- ウィンドウサイズ変更後に配置が再計算される。
- ページ移動後も選択した配置が維持される。

### 61.15 縮小時のAnnotation

- 100％で書いたAnnotationが80％でも同じPDF上の位置に表示される。
- 80％で書いたAnnotationが100％でも同じ位置に表示される。
- 線の太さと文字サイズがページに対して同じ比率で表示される。
- ポインター位置と描画開始位置が一致する。
- PDF外の余白からは描画が始まらない。
- ページ外へはみ出したストロークがページ境界で終了し、ページ端に沿った線が残らない。
- ページ外からページ内へ戻ってもストロークが再開しない。
- 左ページから右ページへまたがる線が作られない。
- ページ遷移アニメーション中に描画が始まらない。
- 倍率変更後も選択、削除、Undo、Redoが機能する。

## 62. 今回実装しない機能

- AI
- OCR
- 要約
- 翻訳
- チャット
- クラウド同期
- PDF全文検索
- PDF.js TextLayerによる本文の文字選択・コピー
- 常設サムネイル
- 常設サイドバー
- リボンUI
- 大量の図形
- PDF本文編集
- PDFへのAnnotation焼き込み
- 物理的ページカール
- 水平スワイプ
- フリーハンド文字認識
- 100％を超える拡大表示
- 任意倍率の数値入力
- 表示倍率のキーボードショートカット
- PDF外の余白への書き込み
- ページ横の専用メモ欄

## 63. UX判断基準

PDFの大きさ、1ページ移動の確実性、Annotationの正確性、UIの邪魔にならなさを見栄えより優先。

縮小表示は書き込みやすさのための任意機能とし、初期状態の大きさを犠牲にしない。

## 64. 最終的に目指す使用感

```text
Page 3 | Page 4
        ↓
Page 4 | Page 5
        ↓
Page 5 | Page 6
```

1ホイールジェスチャーで1ページだけ進む。

書き込みたいときは表示ボタンから90％・80％に縮小し、周囲に余裕を持たせて書き込める。

## 65. 最重要事項

- PDF2ページが大きい（初期状態）
- 任意の隣接2ページを表示できる
- ホイールで1ページずつ確実に進む
- Annotation位置が正確（倍率・配置を変えてもずれない）
- UIがPDF閲覧を邪魔しない

## 66. 実装開始時

既存コードがあれば、構成、package.json、PDF.js、状態管理、CSS、保存、テストを確認してから実装する。

以下に該当する場合は、実装前に報告する。

- CSS `transform: scale()` による拡大縮小を使っている
- PDF.js TextLayerを使っている（削除するか無効化するかを提案する）
- ツールバーがPDF表示領域の上に重なる構造になっている
- Annotation座標を `clamp` でページ内へ押し込んでいる

第3.1～3.4節と第61.1～61.12節は要約形式である。既存コードやテストに、より詳細な仕様があると判断した場合は、相違点を報告してから実装する。

## 67. Claude Codeへの実行指示

実装前にMust / Should / Futureへ分類する。

Phase 1から順番に実装し、各Phase終了時に以下を確認する。

- 変更ファイル
- 実装済み仕様
- 未実装仕様
- テスト結果
- 次Phaseへの影響

仕様にない機能を独自判断で足さない。

仕様変更が必要なら以下を明示する。

- 問題点
- 原因
- 代替案
- UXへの影響
