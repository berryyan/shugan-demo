import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // viteSingleFile：把 JS/CSS 全部内联进 dist/index.html，
  // 产出单个 HTML 文件，双击或发送到手机/Pad 即可离线运行
  plugins: [inspectAttr(), react(), viteSingleFile()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
