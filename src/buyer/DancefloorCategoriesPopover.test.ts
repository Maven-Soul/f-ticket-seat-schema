import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import DancefloorCategoriesPopover from './DancefloorCategoriesPopover.vue'
import type { BuyerSimulationSettings } from './simulationSettings'

const priceGroups: SeatMapPricingGroupOption[] = [
  { key: 'early', name: 'Early bird', color: '#22c55e', price_amount: 150000 },
  { key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 },
]

const objects: SeatMapObject[] = [
  { external_key: 'a1', type: 'seat', label: null, row: '1', number: '1', price_group_key: 'early', x: 0, y: 0 },
  { external_key: 'floor', type: 'dancefloor', label: 'Танцпол', capacity: 100, price_group_key: 'floor', x: 0, y: 0 },
  { external_key: 'vip', type: 'dancefloor', label: null, capacity: 20, price_group_key: null, x: 0, y: 0 },
]

const normalize = (value: string) => value.replace(/\s+/g, ' ')

function mountPopover(modelValue: BuyerSimulationSettings = { dancefloorCategories: {} }) {
  return mount(DancefloorCategoriesPopover, { props: { objects, priceGroups, modelValue }, attachTo: document.body })
}

function checkbox(wrapper: VueWrapper, objectKey: string, groupKey: string) {
  return wrapper.get<HTMLInputElement>(`[data-testid="dancefloor-category-${objectKey}-${groupKey}"]`)
}

async function open(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="dancefloor-categories-trigger"]').trigger('click')
}

describe('DancefloorCategoriesPopover', () => {
  it('opens a block per dancefloor with every price group, its colour, name and price', async () => {
    const wrapper = mountPopover()
    expect(wrapper.find('[data-testid="dancefloor-categories-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="dancefloor-categories-trigger"]').text()).toContain('Категории танцполов')

    await open(wrapper)

    const blocks = wrapper.findAll('[data-testid="dancefloor-categories-block"]')
    expect(blocks.map(block => block.find('h3').text())).toEqual(['Танцпол', 'Танцпол'])
    expect(blocks[0]!.findAll('label').map(label => label.findAll('span').map(span => normalize(span.text())))).toEqual([
      ['', 'Early bird', '1 500 ₽'],
      ['', 'Стандарт', '2 500 ₽'],
    ])
    expect(blocks[0]!.find('[data-testid="dancefloor-category-color"]').attributes('style')).toContain('background-color')
    expect(checkbox(wrapper, 'floor', 'floor').element.checked).toBe(true)
    expect(checkbox(wrapper, 'floor', 'early').element.checked).toBe(false)
    expect(checkbox(wrapper, 'vip', 'early').element.checked).toBe(false)
    wrapper.unmount()
  })

  it('emits new settings when a category is toggled and keeps the last checked box disabled', async () => {
    const wrapper = mountPopover({ dancefloorCategories: { vip: ['early'] } })
    await open(wrapper)

    expect(checkbox(wrapper, 'floor', 'floor').attributes('disabled')).toBeDefined()
    expect(checkbox(wrapper, 'floor', 'early').attributes('disabled')).toBeUndefined()

    await checkbox(wrapper, 'floor', 'early').setValue(true)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { dancefloorCategories: { vip: ['early'], floor: ['early', 'floor'] } },
    ])

    await wrapper.setProps({ modelValue: { dancefloorCategories: { vip: ['early'], floor: ['early', 'floor'] } } })
    expect(checkbox(wrapper, 'floor', 'floor').attributes('disabled')).toBeUndefined()

    await checkbox(wrapper, 'floor', 'floor').setValue(false)

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { dancefloorCategories: { vip: ['early'], floor: ['early'] } },
    ])
    wrapper.unmount()
  })

  it('closes on Escape and on a click outside', async () => {
    const wrapper = mountPopover()
    await open(wrapper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="dancefloor-categories-panel"]').exists()).toBe(false)

    await open(wrapper)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="dancefloor-categories-panel"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
