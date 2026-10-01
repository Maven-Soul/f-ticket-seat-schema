import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  block,
  dancefloorArea,
  floorArea,
  keyFactory,
  type NextKey,
  type Point,
  type PriceGroup,
  primitive,
  rectTable,
  roundTable,
  sold,
  studioFile,
} from './helpers'

const SQUARE = { sectorKey: '', seatsTop: 2, seatsBottom: 2, seatsLeft: 2, seatsRight: 2 }
const LONG = { sectorKey: '', seatsTop: 3, seatsBottom: 3, seatsLeft: 1, seatsRight: 1 }
const MIDDLE_ROWS = [
  { y: 400, count: 8 },
  { y: 525, count: 7 },
  { y: 650, count: 8 },
  { y: 775, count: 7 },
  { y: 900, count: 7 },
]

function middleTable(next: NextKey, rowIndex: number, center: Point, label: string): SeatMapObject[] {
  return rowIndex % 2 === 0
    ? rectTable(next, SQUARE, center, label, 45)
    : rectTable(next, LONG, center, label)
}

export function banquetHall(wholeTables: boolean): StudioSchemeFile {
  const next = keyFactory()
  const [dancePrice, hallPrice, premiumPrice] = wholeTables ? [600000, 920000, 930000] : [200000, 500000, 760000]
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: dancePrice }
  const hall: PriceGroup = { key: 'hall', name: wholeTables ? 'Стол в зале' : 'Зал', color: '#2563eb', price_amount: hallPrice }
  const premium: PriceGroup = { key: 'premium', name: wholeTables ? 'Стол у сцены' : 'У сцены', color: '#e11d48', price_amount: premiumPrice }
  const objects: SeatMapObject[] = [
    floorArea(next, null, [60, 60, 1300, 60, 1300, 200, 1540, 200, 1540, 1040, 300, 1040, 300, 960, 60, 960]),
    block(next('stage'), 'Сцена', 560, 90, 400, 70),
    ...dancefloorArea(next, 560, 185, 400, 150, dance),
  ]
  let number = 1

  for (let index = 0; index < 6; index++) {
    objects.push(...sold(rectTable(next, SQUARE, { x: 140, y: 220 + index * 125 }, String(number++)), hall, wholeTables))
  }
  MIDDLE_ROWS.forEach(({ y, count }, rowIndex) => {
    const startX = count === 8 ? 330 : 397.5
    for (let column = 0; column < count; column++) {
      const group = rowIndex === 0 ? premium : hall
      objects.push(...sold(middleTable(next, rowIndex, { x: startX + column * 135, y }, String(number++)), group, wholeTables))
    }
  })
  for (const y of [480, 720]) {
    objects.push(...sold(roundTable(next, '', 8, 36, { x: 1430, y }, String(number++)), premium, wholeTables))
  }
  objects.push(
    primitive(next, 'bar', 'Бар', 80, 80, 200, 36),
    primitive(next, 'bar', 'Бар', 1480, 820, 40, 180),
    primitive(next, 'entrance', 'Выход', 700, 1000, 90, 38),
  )

  return studioFile(
    wholeTables ? 'Пример: банкетный зал, продажа столами' : 'Пример: банкетный зал, 45 столов',
    { width: 1600, height: 1100 },
    [dance, hall, premium],
    null,
    objects,
  )
}
