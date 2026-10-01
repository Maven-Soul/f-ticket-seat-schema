import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import BuyerSimulationPage from './BuyerSimulationPage.vue'
import { loadSimulationSettings } from './simulationSettings'
import { saveBuyerPreviewSnapshot, type BuyerPreviewSnapshot } from './snapshot'

const snapshot: BuyerPreviewSnapshot = {
  name: 'Главный зал',
  canvas: { width: 800, height: 600, background: '#ffffff' },
  objects: [],
  priceGroups: [],
  display: null,
  createdAt: '2026-09-29T10:00:00.000Z',
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().includes(label))
  if (!match) {
    throw new Error(`Button not found: ${label}`)
  }

  return match
}

describe('BuyerSimulationPage', () => {
  beforeEach(() => {
    localStorage.clear()
    saveBuyerPreviewSnapshot('doc-1', snapshot)
  })

  it('shows the scheme name and frames the buyer screen at the selected device size', async () => {
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'doc-1' } })
    const frame = () => wrapper.get('iframe')

    expect(wrapper.text()).toContain('Главный зал')
    expect(frame().attributes('src')).toBe(`${window.location.href.split('#')[0]}#/buyer-frame/doc-1?sold=0`)

    await button(wrapper, '1920 · Десктоп').trigger('click')
    expect([frame().attributes('width'), frame().attributes('height')]).toEqual(['1920', '1080'])
    expect(wrapper.text()).toContain('масштаб 100%')

    await button(wrapper, '375 · Телефон').trigger('click')
    expect([frame().attributes('width'), frame().attributes('height')]).toEqual(['375', '812'])
    expect(button(wrapper, '375 · Телефон').attributes('aria-pressed')).toBe('true')

    await button(wrapper, '768 · Планшет').trigger('click')
    expect([frame().attributes('width'), frame().attributes('height')]).toEqual(['768', '1024'])

    await button(wrapper, '1440 · Ноутбук').trigger('click')
    expect([frame().attributes('width'), frame().attributes('height')]).toEqual(['1440', '900'])

    await button(wrapper, 'Во всё окно').trigger('click')
    expect([frame().attributes('width'), frame().attributes('height')]).toEqual(['100%', '100%'])
  })

  it('keeps the frame on device switches and reloads it with the sold percentage', async () => {
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'doc-1' } })
    const initial = wrapper.get('iframe').element

    await button(wrapper, '375 · Телефон').trigger('click')
    expect(wrapper.get('iframe').element).toBe(initial)

    await button(wrapper, '70%').trigger('click')
    expect(wrapper.get('iframe').attributes('src')).toMatch(/#\/buyer-frame\/doc-1\?sold=70$/)
    expect(wrapper.get('iframe').element).not.toBe(initial)
  })

  it('re-reads the snapshot from the editor on refresh', async () => {
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'doc-1' } })
    const initial = wrapper.get('iframe').element
    saveBuyerPreviewSnapshot('doc-1', { ...snapshot, name: 'Малый зал' })

    await button(wrapper, 'Обновить из редактора').trigger('click')

    expect(wrapper.text()).toContain('Малый зал')
    expect(wrapper.get('iframe').element).not.toBe(initial)
  })

  it('saves dancefloor categories chosen in the popover for the buyer frame', async () => {
    saveBuyerPreviewSnapshot('doc-1', {
      ...snapshot,
      objects: [{ external_key: 'floor', type: 'dancefloor', label: 'Танцпол', capacity: 100, price_group_key: 'floor', x: 0, y: 0 }],
      priceGroups: [
        { key: 'early', name: 'Early bird', color: '#a855f7', price_amount: 120000 },
        { key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 },
      ],
    })
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'doc-1' }, attachTo: document.body })

    await wrapper.get('[data-testid="dancefloor-categories-trigger"]').trigger('click')
    await wrapper.get('[data-testid="dancefloor-category-floor-early"]').setValue(true)

    expect(loadSimulationSettings('doc-1')).toEqual({ dancefloorCategories: { floor: ['early', 'floor'] } })
    expect(wrapper.get<HTMLInputElement>('[data-testid="dancefloor-category-floor-early"]').element.checked).toBe(true)
    wrapper.unmount()
  })

  it('hides the dancefloor categories when the scheme has no dancefloors', () => {
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'doc-1' } })

    expect(wrapper.find('[data-testid="dancefloor-categories-trigger"]').exists()).toBe(false)
  })

  it('reports a missing snapshot', () => {
    const wrapper = mount(BuyerSimulationPage, { props: { documentId: 'missing' } })

    expect(wrapper.text()).toContain('Схема не найдена')
  })
})
