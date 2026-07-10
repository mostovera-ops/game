/**
 * format.test.ts — чистые хелперы панели чата (node env, AGENTS.md §4 уровень 1).
 */
import { describe, it, expect } from 'vitest'
import type { ChatMessage } from '@/types'
import {
  CHAT_BODY_MAX_LEN,
  CLIENT_SEND_COOLDOWN_MS,
  capBadge,
  streetChannelKey,
  townChannelKey,
  unreadCount,
  warmChatError,
} from './format'

function msg(at: string, over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: `m_${at}`, channel: 'town:t1', authorId: 'u1', body: 'hi', at, ...over }
}

describe('townChannelKey / streetChannelKey', () => {
  it('строит канал БЕЗ суффикса :chat (см. state/chat.ts докстринг)', () => {
    expect(townChannelKey('town_1')).toBe('town:town_1')
    expect(streetChannelKey('street_1')).toBe('street:street_1')
  })
})

describe('unreadCount', () => {
  it('0 для пустого списка', () => {
    expect(unreadCount([], 0)).toBe(0)
  })

  it('считает только сообщения строго ПОСЛЕ lastSeenAt', () => {
    const messages = [msg(new Date(1000).toISOString()), msg(new Date(2000).toISOString()), msg(new Date(3000).toISOString())]
    expect(unreadCount(messages, 1500)).toBe(2)
    expect(unreadCount(messages, 3000)).toBe(0)
    expect(unreadCount(messages, 0)).toBe(3)
  })
})

describe('capBadge', () => {
  it('капает на 99+ (19-ui-ux §4.3)', () => {
    expect(capBadge(0)).toBe('0')
    expect(capBadge(42)).toBe('42')
    expect(capBadge(99)).toBe('99')
    expect(capBadge(100)).toBe('99+')
  })
})

describe('warmChatError', () => {
  it('никогда не пусто, различает коды и локаль (P3 — тёплый тон)', () => {
    expect(warmChatError('rate_limited', true)).toContain('переведи дух')
    expect(warmChatError('rate_limited', false)).toContain('fast')
    expect(warmChatError('forbidden', true)).not.toBe(warmChatError('cap_reached', true))
    expect(warmChatError('unknown', true).length).toBeGreaterThan(0)
  })
})

describe('константы', () => {
  it('лимит тела 500 (chat_messages.body, 20-backend) и клиентский debounce > 0', () => {
    expect(CHAT_BODY_MAX_LEN).toBe(500)
    expect(CLIENT_SEND_COOLDOWN_MS).toBeGreaterThan(0)
  })
})
