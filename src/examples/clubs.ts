import { generateRows } from '@fpass/seat-map/editor'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  admissionArea,
  AUTO_DISPLAY,
  block,
  dancefloorArea,
  keyFactory,
  type NextKey,
  type PriceGroup,
  priced,
  rectPoints,
  rotateObjects,
  roundTable,
  sold,
  studioFile,
  zone,
} from './helpers'

function seatLine(next: NextKey, sectorKey: string, row: string, count: number, spacing: number, origin: { x: number; y: number }, rotation: number): SeatMapObject[] {
  const seats = generateRows({ sectorKey, rows: 1, seatsPerRow: count, seatSpacing: spacing, rowSpacing: 0, labelScheme: 'cyrillic', curve: 0 }, origin, next)

  return rotateObjects(seats, origin, rotation).map(seat => ({ ...seat, row, label: `${row}${seat.number}` }))
}

export function clubTwoFloors(): StudioSchemeFile {
  const next = keyFactory()
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 270000 }
  const balcony: PriceGroup = { key: 'balcony', name: '2 этаж', color: '#e11d48', price_amount: 940000 }
  const upperKey = next('zone')
  const objects: SeatMapObject[] = [
    zone(upperKey, '2 этаж', 'Балкон', [60, 140, 150, 140, 150, 770, 1050, 770, 1050, 140, 1140, 140, 1140, 860, 60, 860]),
    ...priced([
      ...seatLine(next, upperKey, 'А', 20, 30, { x: 105, y: 190 }, 90),
      ...seatLine(next, upperKey, 'Б', 22, 42, { x: 160, y: 815 }, 0),
      ...seatLine(next, upperKey, 'В', 20, 30, { x: 1095, y: 190 }, 90),
    ], balcony),
    block(next('stage'), 'Сцена', 420, 160, 360, 70),
    ...admissionArea(next, '1 этаж', 'Танцпол', rectPoints(180, 140, 840, 600), dance, { x: 600, y: 480 })
      .map(object => object.type === 'dancefloor' ? { ...object, label: 'Танцпол' } : object),
  ]

  return studioFile('Пример: клуб в два этажа', { width: 1200, height: 920 }, [dance, balcony], AUTO_DISPLAY, objects)
}

function tableGrid(
  next: NextKey,
  sectorKey: string,
  seats: number,
  radius: number,
  columns: number[],
  rows: number[],
  firstNumber: number,
): SeatMapObject[] {
  const objects: SeatMapObject[] = []
  let number = firstNumber
  for (const y of rows) {
    for (const x of columns) objects.push(...roundTable(next, sectorKey, seats, radius, { x, y }, String(number++)))
  }

  return objects
}

export function clubVip(): StudioSchemeFile {
  const next = keyFactory()
  const vipLight: PriceGroup = { key: 'vip-light', name: 'VIP light', color: '#0891b2', price_amount: 300000 }
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 380000 }
  const superVip2: PriceGroup = { key: 'super-vip-2', name: 'Super VIP 2', color: '#f59e0b', price_amount: 400000 }
  const vip: PriceGroup = { key: 'vip', name: 'VIP', color: '#2563eb', price_amount: 460000 }
  const superVip: PriceGroup = { key: 'super-vip', name: 'Super VIP, стол', color: '#e11d48', price_amount: 840000 }
  const superKey = next('zone')
  const vipKey = next('zone')
  const superTwoKey = next('zone')
  const objects: SeatMapObject[] = [
    zone(superKey, 'Super VIP', 'Super VIP', rectPoints(140, 50, 1020, 160)),
    ...sold(tableGrid(next, superKey, 4, 24, [200, 380, 560, 740, 920, 1100], [130], 1), superVip, true),
    zone(vipKey, 'VIP', 'VIP', rectPoints(60, 250, 400, 620)),
    ...priced(tableGrid(next, vipKey, 12, 50, [160, 360], [350, 560, 770], 7), vip),
    zone(superTwoKey, 'Super VIP 2', 'Super VIP', rectPoints(840, 250, 400, 620)),
    ...priced(tableGrid(next, superTwoKey, 4, 26, [940, 1140], [350, 560, 770], 13), superVip2),
    ...admissionArea(next, 'VIP light', 'VIP', rectPoints(500, 250, 300, 110), vipLight, { x: 650, y: 305 }),
    ...dancefloorArea(next, 500, 390, 300, 460, dance),
    block(next('stage'), 'Сцена', 500, 885, 300, 70),
  ]

  return studioFile('Пример: клуб с VIP', { width: 1300, height: 1000 }, [vipLight, dance, superVip2, vip, superVip], AUTO_DISPLAY, objects)
}
