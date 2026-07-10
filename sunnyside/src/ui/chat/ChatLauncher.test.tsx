/**
 * @vitest-environment jsdom
 *
 * ChatLauncher.test.tsx — HUD-вход в чат: бейдж суммирует Town+Street+Feed, клик
 * открывает `ui_chat` (зеркалит `ui/hud/NotificationBell.test.tsx`-стиль проверки —
 * см. `HudRoot.test.tsx` «колокол» кейс).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import { ChatLauncher } from './ChatLauncher'

describe('ChatLauncher', () => {
  beforeEach(() => {
    useStore.setState({
      ui: { ...useStore.getState().ui, notifications: [], notifLastSeenAt: 0, activePanel: null },
      chat: { channels: {} },
    })
    useStore.getState().resetSession()
  })

  it('без непрочитанных — бейдж не рисуется', () => {
    render(<ChatLauncher />)
    expect(screen.queryByTestId('chat-launcher-badge')).toBeNull()
  })

  it('суммирует непрочитанные Town + Street + Feed в один бейдж', () => {
    useStore.getState().setIdentity({
      userId: 'user_me',
      farmId: 'farm_me',
      streetId: 'street_1',
      townId: 'town_1',
      displayName: 'Me',
      authStatus: 'anon',
    })
    useStore.getState().pushChatMessage('town:town_1', {
      id: 'm1',
      channel: 'town:town_1',
      authorId: 'user_a',
      body: 'hi',
      at: new Date().toISOString(),
    })
    useStore.getState().pushChatMessage('street:street_1', {
      id: 'm2',
      channel: 'street:street_1',
      authorId: 'user_b',
      body: 'yo',
      at: new Date().toISOString(),
    })
    useStore.getState().pushNotification({ id: 'n1', kind: 'system', message: 'x', createdAt: Date.now() })

    render(<ChatLauncher />)
    expect(screen.getByTestId('chat-launcher-badge').textContent).toBe('3')
  })

  it('клик открывает панель ui_chat', () => {
    render(<ChatLauncher />)
    fireEvent.click(screen.getByTestId('chat-launcher'))
    expect(useStore.getState().ui.activePanel).toBe('ui_chat')
  })
})
