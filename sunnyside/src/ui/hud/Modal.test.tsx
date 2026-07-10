/**
 * @vitest-environment jsdom
 *
 * Modal.test.tsx — единый модальный каркас: видимость по `ui.activePanel`,
 * закрытие по крестику/подложке/Escape (19-ui-ux §4.2 правило #1).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useStore } from '@/state'
import { Modal } from './Modal'

describe('Modal (каркас оверлеев)', () => {
  beforeEach(() => {
    useStore.getState().openPanel(null)
  })

  it('скрыт, пока ui.activePanel не совпадает с panelKey', () => {
    render(
      <Modal panelKey="ui_notif_log" title="Лента событий">
        <p>содержимое</p>
      </Modal>,
    )
    expect(screen.queryByTestId('modal-ui_notif_log')).toBeNull()
  })

  it('открывается через openPanel и рендерит children/заголовок', () => {
    useStore.getState().openPanel('ui_notif_log')
    render(
      <Modal panelKey="ui_notif_log" title="Лента событий">
        <p>содержимое</p>
      </Modal>,
    )
    expect(screen.getByTestId('modal-ui_notif_log')).toBeTruthy()
    expect(screen.getByText('Лента событий')).toBeTruthy()
    expect(screen.getByText('содержимое')).toBeTruthy()
  })

  it('крестик закрывает — activePanel становится null', () => {
    useStore.getState().openPanel('ui_notif_log')
    render(
      <Modal panelKey="ui_notif_log" title="Лента событий">
        <p>x</p>
      </Modal>,
    )
    fireEvent.click(screen.getByTestId('modal-close-ui_notif_log'))
    expect(useStore.getState().ui.activePanel).toBeNull()
  })

  it('клик по подложке закрывает, клик по панели — нет', () => {
    useStore.getState().openPanel('ui_notif_log')
    render(
      <Modal panelKey="ui_notif_log" title="Лента событий">
        <p>содержимое</p>
      </Modal>,
    )
    fireEvent.click(screen.getByText('содержимое'))
    expect(useStore.getState().ui.activePanel).toBe('ui_notif_log')

    fireEvent.click(screen.getByTestId('modal-ui_notif_log'))
    expect(useStore.getState().ui.activePanel).toBeNull()
  })

  it('Escape закрывает верхний оверлей', () => {
    useStore.getState().openPanel('ui_notif_log')
    render(
      <Modal panelKey="ui_notif_log" title="Лента событий">
        <p>содержимое</p>
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().ui.activePanel).toBeNull()
  })
})
