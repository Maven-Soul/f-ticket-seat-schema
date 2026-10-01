import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BuyerSimulationFrame from './BuyerSimulationFrame.vue'
import { saveSimulationSettings, simulationSettingsKey } from './simulationSettings'
import { saveBuyerPreviewSnapshot, type BuyerPreviewSnapshot } from './snapshot'

vi.mock('@fpass/seat-map/booking', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  const actual = await vi.importActual<typeof import('@fpass/seat-map/booking')>('@fpass/seat-map/booking')

  return {
    ...actual,
    SeatMapBookingExperience: defineComponent({
      name: 'SeatMapBookingExperience',
      props: {
        canvas: { type: Object, required: true },
        objects: { type: Array, required: true },
        states: { type: Array, default: () => [] },
        display: { type: Object, default: null },
        sectorSummaries: { type: Array, default: () => [] },
        height: { type: Number, default: 520 },
        selectionLimit: { type: Number, default: null },
        ticketLimit: { type: Number, default: null },
        showAccessibleList: { type: Boolean, default: true },
        selectedKeys: { type: Array, default: () => [] },
        admissionAreas: { type: Array, default: () => [] },
        admissionSelections: { type: Array, default: () => [] },
      },
      emits: ['update:selectedKeys', 'update:admissionSelections', 'area-activate'],
      setup: () => () => h('div', { 'data-testid': 'booking-experience' }),
    }),
  }
})

const snapshot: BuyerPreviewSnapshot = {
  name: 'Главный зал',
  canvas: { width: 800, height: 600, background: '#ffffff' },
  objects: [
    { external_key: 'A', type: 'zone', label: 'Партер', x: 0, y: 0, width: 100, height: 100 },
    { external_key: 'a1', type: 'seat', label: null, row: '3', number: '12', sector_key: 'A', price_group_key: 'base', x: 5000, y: 5000 },
    { external_key: 'a2', type: 'seat', label: null, row: '3', number: '13', sector_key: 'A', price_group_key: 'base', x: 5000, y: 5000 },
    { external_key: 'floor', type: 'dancefloor', label: 'Танцпол', capacity: 100, price_group_key: 'floor', x: 5000, y: 5000 },
  ],
  priceGroups: [
    { key: 'base', name: 'Базовая', color: '#0ea5e9', price_amount: 150000 },
    { key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 },
  ],
  display: { section_contents: 'after_zoom', sector_price_labels: true },
  createdAt: '2026-09-29T10:00:00.000Z',
}

const normalize = (value: string) => value.replace(/\s+/g, ' ')
const FLOOR_AREA = 'admission-area:floor'
const FLOOR_OFFER = 'admission-offer:floor:floor'

function floorSelection(quantity: number) {
  return { area_id: FLOOR_AREA, offer_variant_id: FLOOR_OFFER, quantity }
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

function booking(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: 'SeatMapBookingExperience' })
}

describe('BuyerSimulationFrame', () => {
  const initialWidth = window.innerWidth
  const initialHeight = window.innerHeight

  beforeEach(() => {
    localStorage.clear()
    setViewport(1440, 900)
  })

  afterEach(() => {
    setViewport(initialWidth, initialHeight)
  })

  it('asks to open the preview from the editor when there is no snapshot', () => {
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'missing', soldPercent: 0 } })

    expect(wrapper.text()).toContain('Схема не найдена — откройте предпросмотр из редактора.')
    expect(booking(wrapper).exists()).toBe(false)
  })

  it('renders the buyer map with simulated states, sector summaries, display and an order ticket limit', () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })
    const map = booking(wrapper)

    expect(map.props('display')).toEqual(snapshot.display)
    expect(map.props('ticketLimit')).toBe(10)
    expect(map.props('selectionLimit')).toBeNull()
    expect(map.props('height')).toBeGreaterThan(0)
    expect((map.props('states') as { purchasable: boolean }[]).every(state => state.purchasable)).toBe(true)
    expect(map.props('sectorSummaries')).toEqual([
      { sector_key: 'A', price_min_amount: 150000, price_max_amount: 150000, remaining: 2, remaining_display_mode: 'exact' },
    ])
    expect(wrapper.text()).not.toContain('Ценовые группы не заданы')
  })

  it('marks every seat sold at 100 percent', () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 100 } })

    expect((booking(wrapper).props('states') as { status: string }[]).every(state => state.status === 'sold')).toBe(true)
  })

  it('explains unavailable seats when the scheme has no price groups', () => {
    saveBuyerPreviewSnapshot('doc-1', { ...snapshot, priceGroups: [] })
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })

    expect(wrapper.text()).toContain('Ценовые группы не заданы — места показаны как недоступные.')
  })

  it('lists selected seats with the total in the desktop sidebar and clears the order', async () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })

    booking(wrapper).vm.$emit('update:selectedKeys', ['a1'])
    booking(wrapper).vm.$emit('update:admissionSelections', [floorSelection(1)])
    await flushPromises()

    const sidebar = wrapper.get('[data-testid="buyer-order-sidebar"]')
    expect(normalize(sidebar.text())).toContain('Партер · Ряд 3 · Место 12 — 1 500 ₽')
    expect(normalize(sidebar.text())).toContain('Танцпол · Стандарт × 1 — 2 500 ₽')
    expect(normalize(wrapper.get('[data-testid="buyer-order-total"]').text())).toBe('4 000 ₽')
    expect(wrapper.get('[data-testid="buyer-checkout"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="buyer-order-bar"]').exists()).toBe(false)

    await wrapper.get('[data-testid="buyer-order-clear"]').trigger('click')

    expect(booking(wrapper).props('selectedKeys')).toEqual([])
    expect(booking(wrapper).props('admissionSelections')).toEqual([])
    expect(normalize(wrapper.get('[data-testid="buyer-order-total"]').text())).toBe('0 ₽')
  })

  it('passes the dancefloor to the booking map as an admission area with a purchasable state', () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 100 } })
    const map = booking(wrapper)
    const [area] = map.props('admissionAreas') as { id: string, scheme_object_external_key: string, remaining: number, offers: { id: string, name: string, purchasable: boolean }[] }[]

    expect(area).toMatchObject({ id: FLOOR_AREA, scheme_object_external_key: 'floor', remaining: 0 })
    expect(area?.offers.map(offer => [offer.id, offer.name, offer.purchasable])).toEqual([[FLOOR_OFFER, 'Танцпол · Стандарт', false]])

    const open = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })
    const floorState = (booking(open).props('states') as { external_key: string, purchasable: boolean }[])
      .find(state => state.external_key === 'floor')
    expect(floorState?.purchasable).toBe(true)
  })

  it('lists admission selections from the picker, removes them and shares the ticket limit', async () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })

    booking(wrapper).vm.$emit('update:admissionSelections', [floorSelection(2)])
    booking(wrapper).vm.$emit('update:selectedKeys', ['a1'])
    await flushPromises()

    const sidebar = wrapper.get('[data-testid="buyer-order-sidebar"]')
    expect(normalize(sidebar.text())).toContain('Танцпол · Стандарт × 2 — 5 000 ₽')
    expect(normalize(wrapper.get('[data-testid="buyer-order-total"]').text())).toBe('6 500 ₽')
    expect(sidebar.text()).toContain('Билетов: 3 из 10')
    expect(booking(wrapper).props('ticketLimit')).toBe(10)
    const [area] = booking(wrapper).props('admissionAreas') as { offers: { max_quantity_per_order: number }[] }[]
    expect(area?.offers[0]?.max_quantity_per_order).toBe(10)

    await wrapper.get(`[data-testid="buyer-order-remove-${FLOOR_AREA}:${FLOOR_OFFER}"]`).trigger('click')

    expect(booking(wrapper).props('admissionSelections')).toEqual([])
    expect(sidebar.text()).not.toContain('Танцпол')
  })

  it('leaves the order limit to the booking map and keeps picker selections as they are', async () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })

    booking(wrapper).vm.$emit('update:selectedKeys', ['a1', 'a2'])
    await flushPromises()
    booking(wrapper).vm.$emit('update:admissionSelections', [floorSelection(8)])
    await flushPromises()

    expect(booking(wrapper).props('admissionSelections')).toEqual([floorSelection(8)])
    expect(booking(wrapper).props('ticketLimit')).toBe(10)
    expect(wrapper.get('[data-testid="buyer-order-sidebar"]').text()).toContain('Билетов: 10 из 10')
  })

  it('offers every chosen dancefloor category and lists the chosen one in the order', async () => {
    saveBuyerPreviewSnapshot('doc-1', {
      ...snapshot,
      priceGroups: [...snapshot.priceGroups, { key: 'early', name: 'Early bird', color: '#a855f7', price_amount: 120000 }],
    })
    saveSimulationSettings('doc-1', { dancefloorCategories: { floor: ['early', 'floor'] } })
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })
    const [area] = booking(wrapper).props('admissionAreas') as { id: string, offers: { id: string, name: string }[] }[]

    expect(area?.id).toBe(FLOOR_AREA)
    expect(area?.offers.map(offer => [offer.id, offer.name])).toEqual([
      ['admission-offer:floor:early', 'Танцпол · Early bird'],
      [FLOOR_OFFER, 'Танцпол · Стандарт'],
    ])

    booking(wrapper).vm.$emit('update:admissionSelections', [
      { area_id: FLOOR_AREA, offer_variant_id: 'admission-offer:floor:early', quantity: 2 },
    ])
    await flushPromises()

    expect(normalize(wrapper.get('[data-testid="buyer-order-sidebar"]').text())).toContain('Танцпол · Early bird × 2 — 2 400 ₽')
  })

  it('re-reads the dancefloor categories when another window changes them', async () => {
    saveBuyerPreviewSnapshot('doc-1', {
      ...snapshot,
      priceGroups: [...snapshot.priceGroups, { key: 'early', name: 'Early bird', color: '#a855f7', price_amount: 120000 }],
    })
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })
    const offerNames = () => (booking(wrapper).props('admissionAreas') as { offers: { name: string }[] }[])[0]?.offers.map(offer => offer.name)
    expect(offerNames()).toEqual(['Танцпол · Стандарт'])

    saveSimulationSettings('doc-1', { dancefloorCategories: { floor: ['early'] } })
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }))
    await flushPromises()
    expect(offerNames()).toEqual(['Танцпол · Стандарт'])

    window.dispatchEvent(new StorageEvent('storage', { key: simulationSettingsKey('doc-1') }))
    await flushPromises()
    expect(offerNames()).toEqual(['Танцпол · Early bird'])

    wrapper.unmount()
  })

  it('uses a bottom bar with an expandable list on narrow screens', async () => {
    setViewport(375, 812)
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    const wrapper = mount(BuyerSimulationFrame, { props: { documentId: 'doc-1', soldPercent: 0 } })

    booking(wrapper).vm.$emit('update:selectedKeys', ['a2'])
    await flushPromises()

    expect(wrapper.find('[data-testid="buyer-order-sidebar"]').exists()).toBe(false)
    const bar = wrapper.get('[data-testid="buyer-order-bar"]')
    expect(normalize(bar.text())).toContain('1 500 ₽')
    expect(wrapper.text()).not.toContain('Место 13')

    await wrapper.get('[data-testid="buyer-order-toggle"]').trigger('click')

    expect(normalize(wrapper.text())).toContain('Партер · Ряд 3 · Место 13 — 1 500 ₽')
  })
})
