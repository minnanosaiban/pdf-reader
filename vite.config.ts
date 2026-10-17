/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// サブパスに配備しても動くよう相対パスにする
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
