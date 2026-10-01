import { describe, expect, it } from 'vitest'

import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

import { applySimulatedSales, simulatedAdmissionAreas, simulatedSectorSummaries, withAdmissionAreaStates } from './simulation'

function state(key: string, amount = 150000, purchasable = true): SeatMapObjectState {
  return {
    external_key: key,
    purchasable,
    status: purchasable ? 'available' : 'sold',
    current_price_amount: purchasable ? amount : null,
    currency: 'RUB',
    price_color: purchasable ? '#0ea5e9' : null,
    price_group_key: purchasable ? 'base' : null,
  }
}

function zone(key: string, label: string | null): SeatMapObject {
  return { external_key: key, type: 'zone', label, x: 0, y: 0, width: 100, height: 100 }
}

function seat(key: string, sectorKey: string | null, x = 5000): SeatMapObject {
  return { external_key: key, type: 'seat', label: null, row: '1', number: key, sector_key: sectorKey, x, y: 5000 }
}

describe('applySimulatedSales', () => {
  const states = Array.from({ length: 1000 }, (_, index) => state(`seat-${index}`))

  it('keeps every state when nothing is sold', () => {
    expect(applySimulatedSales(states, 0)).toEqual(states)
  })

  it('sells every purchasable state at 100 percent', () => {
    const sold = applySimulatedSales(states, 100)

    expect(sold.every(candidate => candidate.purchasable === false && candidate.status === 'sold')).toBe(true)
  })

  it('sells a deterministic share of seats close to the requested percentage', () => {
    const first = applySimulatedSales(states, 30)
    const second = applySimulatedSales(states, 30)
    const soldCount = first.filter(candidate => candidate.status === 'sold').length

    expect(second).toEqual(first)
    expect(soldCount).toBeGreaterThan(250)
    expect(soldCount).toBeLessThan(350)
  })

  it('sells a superset of the lower percentage when the percentage grows', () => {
    const sold30 = new Set(applySimulatedSales(states, 30).filter(c => c.status === 'sold').map(c => c.external_key))
    const sold70 = new Set(applySimulatedSales(states, 70).filter(c => c.status === 'sold').map(c => c.external_key))

    expect([...sold30].every(key => sold70.has(key))).toBe(true)
  })

  it('keeps the rest of the state when marking it sold and leaves unpriced states intact', () => {
    const unpriced = state('unpriced', 0, false)
    const [sold, untouched] = applySimulatedSales([state('seat-1'), unpriced], 100)

    expect(sold).toEqual({ ...state('seat-1'), purchasable: false, status: 'sold' })
    expect(untouched).toBe(unpriced)
  })
})

describe('simulatedSectorSummaries', () => {
  it('summarises purchasable members of every zone with exact remaining counts', () => {
    const objects = [
      zone('A', 'Партер'),
      zone('B', 'Балкон'),
      zone('empty', 'Пустая'),
      seat('a1', 'A'),
      seat('a2', 'A'),
      seat('a3', 'A'),
      seat('b1', 'B'),
    ]
    const states = [
      state('a1', 150000),
      state('a2', 250000),
      state('a3', 900000, false),
      state('b1', 0, false),
    ]

    expect(simulatedSectorSummaries(objects, states)).toEqual([
      { sector_key: 'A', price_min_amount: 150000, price_max_amount: 250000, remaining: 2, remaining_display_mode: 'exact' },
      { sector_key: 'B', price_min_amount: null, price_max_amount: null, remaining: 0, remaining_display_mode: 'exact' },
    ])
  })
})

describe('simulatedAdmissionAreas', () => {
  const priceGroups: SeatMapPricingGroupOption[] = [
    { key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 },
    { key: 'free', name: 'Бесплатно', color: '#22c55e', price_amount: 0 },
  ]

  function dancefloor(key: string, overrides: Partial<SeatMapObject> = {}): SeatMapObject {
    return { external_key: key, type: 'dancefloor', label: 'Танцпол', capacity: 200, price_group_key: 'floor', x: 0, y: 0, ...overrides }
  }

  it('builds one area with a priced offer per dancefloor', () => {
    const [area, ...rest] = simulatedAdmissionAreas([seat('a1', null), dancefloor('floor')], priceGroups, 0)

    expect(rest).toEqual([])
    expect(area).toEqual({
      id: 'admission-area:floor',
      external_key: 'floor',
      scheme_object_external_key: 'floor',
      remaining: 200,
      remaining_display_mode: 'exact',
      offers: [{
        id: 'admission-offer:floor:floor',
        external_key: 'floor:floor',
        name: 'Танцпол · Стандарт',
        description: null,
        price: { amount: 250000, currency: 'RUB', color: '#f97316', group_key: 'floor' },
        remaining: 200,
        min_quantity_per_order: 1,
        max_quantity_per_order: 10,
        composition: [],
        terms: [],
        purchasable: true,
      }],
    })
  })

  it('names the offer after the dancefloor label and skips dancefloors without a price group', () => {
    const areas = simulatedAdmissionAreas([
      dancefloor('main', { label: ' Главный танцпол ' }),
      dancefloor('unlabelled', { label: null }),
      dancefloor('unpriced', { price_group_key: null }),
      dancefloor('unknown', { price_group_key: 'missing' }),
    ], priceGroups, 0)

    expect(areas.map(area => [area.id, area.offers[0]?.name])).toEqual([
      ['admission-area:main', 'Главный танцпол · Стандарт'],
      ['admission-area:unlabelled', 'Танцпол · Стандарт'],
    ])
  })

  it('subtracts the simulated sold share from the capacity', () => {
    const [area] = simulatedAdmissionAreas([dancefloor('floor')], priceGroups, 30)

    expect(area?.remaining).toBe(140)
    expect(area?.offers[0]?.remaining).toBe(140)
    expect(area?.offers[0]?.purchasable).toBe(true)
  })

  it('sells the dancefloor out at 100 percent and never sells free offers', () => {
    const [soldOut, free] = simulatedAdmissionAreas([
      dancefloor('floor'),
      dancefloor('free', { price_group_key: 'free' }),
    ], priceGroups, 100)
    const [freeAtZero] = simulatedAdmissionAreas([dancefloor('free', { price_group_key: 'free' })], priceGroups, 0)

    expect(soldOut?.remaining).toBe(0)
    expect(soldOut?.offers[0]?.purchasable).toBe(false)
    expect(free?.offers[0]?.purchasable).toBe(false)
    expect(freeAtZero?.offers[0]?.purchasable).toBe(false)
  })

  it('leaves the remaining count open when the dancefloor has no capacity', () => {
    const [open] = simulatedAdmissionAreas([dancefloor('floor', { capacity: null })], priceGroups, 50)
    const [closed] = simulatedAdmissionAreas([dancefloor('floor', { capacity: null })], priceGroups, 100)

    expect(open?.remaining).toBeNull()
    expect(open?.offers[0]?.purchasable).toBe(true)
    expect(closed?.offers[0]?.purchasable).toBe(false)
  })

  it('builds one offer per chosen category in one area', () => {
    const groups: SeatMapPricingGroupOption[] = [
      ...priceGroups,
      { key: 'early', name: 'Early bird', color: '#a855f7', price_amount: 150000 },
    ]
    const settings = { dancefloorCategories: { floor: ['early', 'missing', 'floor'] } }
    const areas = simulatedAdmissionAreas([dancefloor('floor')], groups, 30, settings)

    expect(areas).toHaveLength(1)
    expect(areas[0]?.id).toBe('admission-area:floor')
    expect(areas[0]?.offers.map(offer => [offer.id, offer.external_key, offer.name, offer.price.amount, offer.price.color, offer.remaining]))
      .toEqual([
        ['admission-offer:floor:early', 'floor:early', 'Танцпол · Early bird', 150000, '#a855f7', 140],
        ['admission-offer:floor:floor', 'floor:floor', 'Танцпол · Стандарт', 250000, '#f97316', 140],
      ])
  })

  it('keeps the area purchasable while any category is and builds areas for dancefloors without an own group', () => {
    const settings = { dancefloorCategories: { floor: ['free', 'floor'], unpriced: ['floor'] } }
    const [floor, unpriced] = simulatedAdmissionAreas([
      dancefloor('floor'),
      dancefloor('unpriced', { price_group_key: null }),
    ], priceGroups, 0, settings)

    expect(floor?.offers.map(offer => offer.purchasable)).toEqual([false, true])
    expect(withAdmissionAreaStates([state('floor', 0, false)], [floor!])[0]?.purchasable).toBe(true)
    expect(unpriced?.offers.map(offer => offer.name)).toEqual(['Танцпол · Стандарт'])
  })
})

describe('withAdmissionAreaStates', () => {
  it('makes admission objects purchasable only while their area has a purchasable offer', () => {
    const objects: SeatMapObject[] = [
      { external_key: 'floor', type: 'dancefloor', label: 'Танцпол', capacity: 100, price_group_key: 'base', x: 0, y: 0 },
      { external_key: 'full', type: 'dancefloor', label: 'Танцпол', capacity: 0, price_group_key: 'base', x: 0, y: 0 },
    ]
    const groups: SeatMapPricingGroupOption[] = [{ key: 'base', name: 'База', color: '#0ea5e9', price_amount: 150000 }]
    const areas = simulatedAdmissionAreas(objects, groups, 0)
    const states = [state('a1'), { ...state('floor'), purchasable: false, status: 'sold' }, state('full')]

    expect(withAdmissionAreaStates(states, areas)).toEqual([
      state('a1'),
      state('floor'),
      { ...state('full'), purchasable: false, status: 'sold' },
    ])
  })
})
