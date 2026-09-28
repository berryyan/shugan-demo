import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// HashRouter：保证打包后的单文件在 file:// 协议下也能正常路由（手机/平板/电脑直接打开）
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
