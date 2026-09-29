import { describe, expect, it } from 'vitest'

import type { SeatMapAdmissionArea, SeatMapAdmissionSummaryRow } from '@fpass/seat-map/booking'
import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

import { admissionAreasWithinLimit, buyerOrderLines, formatRubles, limitAdmissionSelections } from './order'

const objects: SeatMapObject[] = [
  { external_key: 'A', type: 'zone', label: ' Партер ', x: 0, y: 0, width: 100, height: 100 },
  { external_key: 'a1', type: 'seat', label: null, row: '3', number: '12', sector_key: 'A', x: 5000, y: 5000 },
  { external_key: 'loose', type: 'seat', label: null, row: '1', number: '2', x: 5000, y: 5000 },
  { external_key: 'floor', type: 'dancefloor', label: 'Танцпол', x: 5000, y: 5000 },
]

function state(key: string, amount: number): SeatMapObjectState {
  return { external_key: key, purchasable: true, status: 'available', current_price_amount: amount, currency: 'RUB', price_color: '#000', price_group_key: 'g' }
}

const normalize = (value: string) => value.replace(/\s/g, ' ')

function area(id: string, offerIds: string[]): SeatMapAdmissionArea {
  return {
    id,
    external_key: id,
    scheme_object_external_key: id,
    remaining: 100,
    remaining_display_mode: 'exact',
    offers: offerIds.map(offerId => ({
      id: offerId,
      external_key: offerId,
      name: offerId,
      description: null,
      price: { amount: 100000, currency: 'RUB' },
      remaining: 100,
      min_quantity_per_order: 1,
      max_quantity_per_order: 10,
      composition: [],
      terms: [],
      purchasable: true,
    })),
  }
}

describe('buyerOrderLines', () => {
  it('describes seats by sector, row and number and other units by their label', () => {
    const lines = buyerOrderLines(objects, [state('a1', 150000), state('loose', 90000), state('floor', 200000)], ['a1', 'loose', 'floor', 'missing'])

    expect(lines.map(line => [line.key, line.label, line.amount])).toEqual([
      ['a1', 'Партер · Ряд 3 · Место 12', 150000],
      ['loose', 'Ряд 1 · Место 2', 90000],
      ['floor', 'Танцпол', 200000],
    ])
  })

  it('adds removable admission lines with their quantity after the seats', () => {
    const row: SeatMapAdmissionSummaryRow = {
      area_id: 'area-floor',
      offer_variant_id: 'offer-vip',
      offer_name: 'Танцпол · VIP',
      quantity: 3,
      unit_price: 200000,
      total_amount: 600000,
      currency: 'RUB',
      composition: [],
      terms: [],
    }
    const lines = buyerOrderLines(objects, [state('a1', 150000)], ['a1'], [row])

    expect(lines).toEqual([
      { key: 'a1', label: 'Партер · Ряд 3 · Место 12', amount: 150000, quantity: 1, removable: false },
      { key: 'area-floor:offer-vip', label: 'Танцпол · VIP', amount: 600000, quantity: 3, removable: true },
    ])
  })

  it('formats minor units as whole rubles', () => {
    expect(normalize(formatRubles(150000))).toBe('1 500 ₽')
  })
})

describe('limitAdmissionSelections', () => {
  it('trims admission quantities in order until they fit the limit', () => {
    const selections = [
      { area_id: 'x', offer_variant_id: 'a', quantity: 4 },
      { area_id: 'x', offer_variant_id: 'b', quantity: 4 },
      { area_id: 'y', offer_variant_id: 'c', quantity: 2 },
    ]

    expect(limitAdmissionSelections(selections, 10)).toEqual(selections)
    expect(limitAdmissionSelections(selections, 6)).toEqual([
      { area_id: 'x', offer_variant_id: 'a', quantity: 4 },
      { area_id: 'x', offer_variant_id: 'b', quantity: 2 },
    ])
    expect(limitAdmissionSelections(selections, 0)).toEqual([])
  })
})

describe('admissionAreasWithinLimit', () => {
  it('caps every offer by the tickets left for its area without making it unavailable', () => {
    const areas = [area('x', ['a', 'b']), area('y', ['c'])]
    const selections = [
      { area_id: 'x', offer_variant_id: 'a', quantity: 2 },
      { area_id: 'y', offer_variant_id: 'c', quantity: 3 },
    ]

    const limited = admissionAreasWithinLimit(areas, selections, 7)
    const maxima = limited.map(candidate => candidate.offers.map(offer => offer.max_quantity_per_order))

    expect(maxima).toEqual([[4, 4], [5]])
    expect(admissionAreasWithinLimit(areas, [], 20).map(c => c.offers.map(o => o.max_quantity_per_order))).toEqual([[10, 10], [10]])
    expect(admissionAreasWithinLimit(areas, selections, 5).map(c => c.offers.map(o => o.max_quantity_per_order))).toEqual([[2, 2], [3]])
    expect(admissionAreasWithinLimit(areas, [], 0).map(c => c.offers.map(o => o.max_quantity_per_order))).toEqual([[1, 1], [1]])
    expect(areas[0]?.offers[0]?.max_quantity_per_order).toBe(10)
  })
})
