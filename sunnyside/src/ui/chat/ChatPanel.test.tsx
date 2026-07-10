/**
 * @vitest-environment jsdom
 *
 * ChatPanel.test.tsx — рендер + отправка (W3). Мокаем `SocialSystem` (DI через
 * контекст, зеркалит `ui/street/StreetPanel.test.tsx`) — компонент не ходит в сеть сам
 * (AGENTS.md §0.3). Своё сообщение появляется в списке ТОЛЬКО после `res.ok`
 * (см. `state/chat.ts`/`ChatPanel.tsx` докстринги).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SocialSystem } from '@/engine/contracts'
import { useStore } from '@/state'
import { SocialSystemProvider } from '../street/SocialSystemContext'
import { ChatPanel } from './ChatPanel'

function makeSocialSystem(overrides: Partial<SocialSystem> = {}): SocialSystem {
  return {
    help: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    gift: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    sit: vi.fn(async () => ({ ok: true, data: undefined }) as never),
    chat: vi.fn(async () => ({ ok: true, data: { messageId: 'm1' } }) as never),
    ...overrides,
  }
}

function seedIdentity() {
  useStore.getState().setIdentity({
    userId: 'user_me',
    farmId: 'farm_me',
    streetId: 'street_1',
    townId: 'town_1',
    displayName: 'Me',
    authStatus: 'anon',
  })
}

describe('ChatPanel (W3)', () => {
  beforeEach(() => {
    useStore.setState({
      ui: { ...useStore.getState().ui, locale: 'ru', notifications: [], notifLastSeenAt: 0 },
      chat: { channels: {} },
      town: null,
    })
    useStore.getState().resetSession()
  })

  it('без сессии показывает тёплый empty-state вместо чата', () => {
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('chat-empty-no-channel')).toBeTruthy()
  })

  it('с сессией показывает "Начни разговор" на пустом канале', () => {
    seedIdentity()
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('chat-empty-messages')).toBeTruthy()
  })

  it('отправка сообщения вызывает SocialSystem.chat с town-каналом и кладёт сообщение в список после ok', async () => {
    seedIdentity()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <ChatPanel />
      </SocialSystemProvider>,
    )

    fireEvent.change(screen.getByTestId('chat-composer-input'), { target: { value: 'привет, стрит!' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-send-btn'))
    })

    expect(social.chat).toHaveBeenCalledWith('town:town_1', 'привет, стрит!', undefined)
    expect(screen.getByTestId('chat-message-m1').textContent).toContain('привет, стрит!')
    expect((screen.getByTestId('chat-composer-input') as HTMLInputElement).value).toBe('')
  })

  it('переключение на вкладку Стрит шлёт в street-канал', async () => {
    seedIdentity()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('chat-tab-street'))
    fireEvent.change(screen.getByTestId('chat-composer-input'), { target: { value: 'кто берёт гриль?' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-send-btn'))
    })
    expect(social.chat).toHaveBeenCalledWith('street:street_1', 'кто берёт гриль?', undefined)
  })

  it('клик по стикеру отправляет мгновенно со stickerKey', async () => {
    seedIdentity()
    const social = makeSocialSystem()
    render(
      <SocialSystemProvider value={social}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('chat-sticker-toggle'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-sticker-sk_pie'))
    })
    expect(social.chat).toHaveBeenCalledWith('town:town_1', 'пирог', 'sk_pie')
  })

  it('отказ (rate_limited) не добавляет сообщение и показывает тёплый тост', async () => {
    seedIdentity()
    const social = makeSocialSystem({
      chat: vi.fn(async () => ({ ok: false, error: { code: 'rate_limited', message: 'too fast' } }) as never),
    })
    render(
      <SocialSystemProvider value={social}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    fireEvent.change(screen.getByTestId('chat-composer-input'), { target: { value: 'спам' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-send-btn'))
    })
    expect(screen.getByTestId('chat-empty-messages')).toBeTruthy() // список остался пустым
    expect(useStore.getState().ui.toasts.some((t) => t.kind === 'warn')).toBe(true)
  })

  it('вкладка Лента показывает уведомления (алиас S4, 19-ui-ux §3.6 W3)', () => {
    seedIdentity()
    useStore.getState().pushNotification({ id: 'n1', kind: 'system', message: 'Грузовик вернулся', createdAt: 1000 })
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    fireEvent.click(screen.getByTestId('chat-tab-feed'))
    expect(screen.getByText('Грузовик вернулся')).toBeTruthy()
  })

  it('бейдж непросмотренной вкладки виден, пока её не открыли — открытие снимает бейдж', () => {
    seedIdentity()
    // Сообщение пришло в СТРИТ-канал; активная вкладка по умолчанию — Town, поэтому
    // Street остаётся непрочитанной, а её бейдж должен быть виден.
    useStore.getState().pushChatMessage('street:street_1', {
      id: 'm_street_1',
      channel: 'street:street_1',
      authorId: 'user_a',
      body: 'кто берёт гриль?',
      at: new Date(Date.now() - 1000).toISOString(), // недавно, но раньше момента открытия вкладки
    })
    render(
      <SocialSystemProvider value={makeSocialSystem()}>
        <ChatPanel />
      </SocialSystemProvider>,
    )
    expect(screen.getByTestId('chat-tab-badge-street').textContent).toBe('1')

    fireEvent.click(screen.getByTestId('chat-tab-street'))
    expect(screen.queryByTestId('chat-tab-badge-street')).toBeNull()
  })
})
