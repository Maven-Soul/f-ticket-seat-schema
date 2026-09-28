import { describe, expect, it } from 'vitest'

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

  it('formats minor units as whole rubles', () => {
    expect(normalize(formatRubles(150000))).toBe('1 500 ₽')
  })
})
