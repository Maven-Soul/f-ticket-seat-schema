import { describe, expect, it } from 'vitest'

import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

import { applySimulatedSales, simulatedSectorSummaries } from './simulation'

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
