import { describe, expect, it } from 'vitest'

import type { SeatMapAdmissionSummaryRow } from '@fpass/seat-map/booking'
import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

import { buyerOrderLines, formatRubles } from './order'

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
