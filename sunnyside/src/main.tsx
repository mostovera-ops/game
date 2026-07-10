/**
 * main.tsx — точка входа (21-client §3.2). Порядок инициализации:
 *  1. Прочитать дебаг-параметры (?screen=/?net=/…) → ui.debug (только dev/e2e).
 *  2. (позже) Supabase-сессия, serverOffset, гидрация слайсов, Realtime, дренаж очереди.
 *     Эти шаги подключит net/bootstrap-агент; здесь — минимальный рабочий каркас.
 *  3. Смонтировать <App/> (свитч сцены + HUD). Роутинг сцен — в сторе, не в URL.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useStore } from './state'
import { parseDebugParams, isDebugEnabled } from './bootstrap/debug'
import './index.css'

// Шаг 1 — дебаг-оверрайды URL (игнорируются в проде).
if (isDebugEnabled()) {
  const debug = parseDebugParams(window.location.search)
  useStore.getState().setDebug(debug)
  if (debug.screen) useStore.getState().goto(debug.screen)
  if (debug.perf === 'lite') useStore.getState().setLiteMode(true)
  if (debug.net === 'offline') useStore.getState().setOnline(false)
}

// TODO(net-bootstrap): createBackendAdapter().init() → ensureSession → getServerTime
//   (serverOffset) → гидрация слайсов → subscribe(Realtime) → дренаж очереди (§3.2 шаги 2–6).

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
