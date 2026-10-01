import { generateConcentricRows } from '@fpass/seat-map/editor'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  admissionArea,
  AUTO_DISPLAY,
  block,
  keyFactory,
  type NextKey,
  type Point,
  type PriceGroup,
  priced,
  rectPoints,
  regularPolygonPoints,
  ringPoints,
  roundTable,
  soldWhole,
  studioFile,
  zone,
} from './helpers'

const CENTER: Point = { x: 800, y: 850 }

function polar(radius: number, angle: number): Point {
  const radians = (angle * Math.PI) / 180

  return { x: CENTER.x + Math.cos(radians) * radius, y: CENTER.y + Math.sin(radians) * radius }
}

function curvedSector(next: NextKey, label: string, startAngle: number, price: PriceGroup): SeatMapObject[] {
  const zoneKey = next('zone')

  return [
    zone(zoneKey, label, 'Сектора', ringPoints(CENTER, 365, 425, startAngle - 2, startAngle + 48)),
    ...priced(generateConcentricRows(
      {
        sectorKey: zoneKey,
        rows: 2,
        seatsPerRow: [12, 13],
        innerRadius: 380,
        rowSpacing: 28,
        startAngle,
        endAngle: startAngle + 46,
        labelScheme: 'numeric',
      },
      CENTER,
      next,
    ), price),
  ]
}

function studio(next: NextKey, label: string, x: number, y: number, price: PriceGroup): SeatMapObject[] {
  return admissionArea(next, label, 'Студии', rectPoints(x, y, 170, 100), price, { x: x + 85, y: y + 50 })
}

export function concertClub(): StudioSchemeFile {
  const next = keyFactory()
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 180000 }
  const sector: PriceGroup = { key: 'sector', name: 'Сектора A и B', color: '#2563eb', price_amount: 280000 }
  const standing: PriceGroup = { key: 'vip-standing', name: 'VIP без места', color: '#0891b2', price_amount: 380000 }
  const table: PriceGroup = { key: 'table', name: 'Стол', color: '#f59e0b', price_amount: 1800000 }
  const box: PriceGroup = { key: 'studio', name: 'Студия', color: '#e11d48', price_amount: 3000000 }
  const tableAt = (center: Point, label: string): SeatMapObject[] => soldWhole(roundTable(next, '', 4, 24, center, label), table)
  const objects: SeatMapObject[] = [
    ...admissionArea(next, 'VIP без места', 'VIP', rectPoints(600, 200, 400, 100), standing, { x: 800, y: 250 }),
    ...studio(next, 'Студия W1', 60, 60, box),
    ...studio(next, 'Студия W2', 1370, 60, box),
  ]

  for (let index = 0; index < 5; index++) {
    objects.push(...tableAt(polar(500, 277 + index * 14), `${index + 1}A`))
    objects.push(...tableAt(polar(500, 263 - index * 14), `${index + 1}B`))
  }
  for (let index = 0; index < 5; index++) {
    objects.push(...tableAt({ x: 1420, y: 420 + index * 110 }, `${index + 6}A`))
    objects.push(...tableAt({ x: 180, y: 420 + index * 110 }, `${index + 6}B`))
  }

  objects.push(
    ...curvedSector(next, 'Сектор B', 197, sector),
    ...curvedSector(next, 'Сектор A', 297, sector),
    ...admissionArea(next, 'Танцпол', 'Танцпол', regularPolygonPoints({ x: 800, y: 660 }, 140, 6), dance, { x: 800, y: 660 }),
    block(next('stage'), 'Сцена', 600, 800, 400, 70),
    ...studio(next, 'Студия B1', 60, 960, box),
    ...studio(next, 'Студия W3', 1370, 960, box),
  )

  return studioFile('Пример: концертный клуб с секторами', { width: 1600, height: 1100 }, [dance, sector, standing, table, box], AUTO_DISPLAY, objects)
}
