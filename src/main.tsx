import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource/yomogi";
import "./styles.css";

// Canvas は未使用のフォントを自動で読み込まないため、先に読み込んでおく（読み込み完了で再描画される）
void document.fonts?.load('16px "Yomogi"', "あA").catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
