import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { saveBuyerPreviewSnapshot, type BuyerPreviewSnapshot } from '../buyer/snapshot'
import BuyerModeView from './BuyerModeView.vue'

const snapshot: BuyerPreviewSnapshot = {
  name: 'Главный зал',
  canvas: { width: 800, height: 600, background: '#ffffff' },
  objects: [],
  priceGroups: [],
  display: null,
  createdAt: '2026-10-01T10:00:00.000Z',
}

const withDancefloor: BuyerPreviewSnapshot = {
  ...snapshot,
  objects: [{ external_key: 'floor', type: 'dancefloor', label: 'Танцпол', price_group_key: 'floor', x: 0, y: 0 }],
  priceGroups: [{ key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 }],
}

const base = window.location.href.split('#')[0]

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().includes(label))
  if (!match) {
    throw new Error(`Button not found: ${label}`)
  }

  return match
}

describe('BuyerModeView', () => {
  beforeEach(() => {
    localStorage.clear()
    saveBuyerPreviewSnapshot('doc-1', snapshot)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('frames the buyer screen of the scheme with the device controls', () => {
    const wrapper = mount(BuyerModeView, { props: { documentId: 'doc-1', snapshotVersion: 1 } })

    expect(wrapper.get('iframe').attributes('src')).toBe(`${base}#/buyer-frame/doc-1?sold=0`)
    expect(wrapper.text()).toContain('1440 · Ноутбук')
    expect(wrapper.text()).toContain('Продано:')
    expect(wrapper.text()).not.toContain('Обновить из редактора')
  })

  it('opens the standalone buyer page in a new tab', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = mount(BuyerModeView, { props: { documentId: 'doc-1', snapshotVersion: 1 } })

    await button(wrapper, 'Открыть в отдельной вкладке').trigger('click')

    expect(open).toHaveBeenCalledWith(`${base}#/buyer/doc-1`, '_blank')
  })

  it('reloads the frame and the snapshot when a new snapshot is written', async () => {
    const wrapper = mount(BuyerModeView, { props: { documentId: 'doc-1', snapshotVersion: 1 } })
    const initial = wrapper.get('iframe').element
    expect(wrapper.find('[data-testid="dancefloor-categories-trigger"]').exists()).toBe(false)

    saveBuyerPreviewSnapshot('doc-1', withDancefloor)
    await wrapper.setProps({ snapshotVersion: 2 })

    expect(wrapper.get('iframe').element).not.toBe(initial)
    expect(wrapper.find('[data-testid="dancefloor-categories-trigger"]').exists()).toBe(true)
  })
})
