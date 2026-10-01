import { generateConcentricRows, generateRows } from '@fpass/seat-map/editor'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  admissionArea,
  AUTO_DISPLAY,
  floorArea,
  keyFactory,
  type NextKey,
  type Point,
  type PriceGroup,
  priced,
  rectPoints,
  ringPoints,
  studioFile,
  zone,
} from './helpers'

const CENTER_Y = 1100
const LEFT_END: Point = { x: 1200, y: CENTER_Y }
const RIGHT_END: Point = { x: 1800, y: CENTER_Y }
const SIDE_SECTORS = [1200, 1400, 1600]
const SPACING = 20
const ROW_SPACING = 22

interface Tier {
  number: number
  group: string
  zoneInner: number
  zoneOuter: number
  seatInner: number
  rows: number
  side: PriceGroup
  end: PriceGroup
}

function mirror(points: number[]): number[] {
  return points.map((value, index) => (index % 2 === 1 ? 2 * CENTER_Y - value : value))
}

function sideSector(next: NextKey, tier: Tier, label: string, x: number, top: boolean): SeatMapObject[] {
  const zoneKey = next('zone')
  const points = rectPoints(x + 2, CENTER_Y + tier.zoneInner, 196, tier.zoneOuter - tier.zoneInner)
  const seats = generateRows(
    { sectorKey: zoneKey, rows: tier.rows, seatsPerRow: 10, seatSpacing: SPACING, rowSpacing: ROW_SPACING, labelScheme: 'numeric', curve: 0 },
    { x: x + 10, y: CENTER_Y + tier.seatInner },
    next,
  )

  return [
    zone(zoneKey, label, tier.group, top ? mirror(points) : points),
    ...priced(top ? seats.map(seat => ({ ...seat, y: 2 * CENTER_Y - seat.y })) : seats, tier.side),
  ]
}

function endSector(next: NextKey, tier: Tier, label: string, center: Point, start: number): SeatMapObject[] {
  const zoneKey = next('zone')
  const sweep = (56 * Math.PI) / 180
  const seatsPerRow = Array.from({ length: tier.rows }, (_, row) => Math.floor(((tier.seatInner + row * ROW_SPACING) * sweep) / SPACING) + 1)

  return [
    zone(zoneKey, label, tier.group, ringPoints(center, tier.zoneInner, tier.zoneOuter, start + 0.75, start + 59.25)),
    ...priced(generateConcentricRows(
      {
        sectorKey: zoneKey,
        rows: tier.rows,
        seatsPerRow,
        innerRadius: tier.seatInner,
        rowSpacing: ROW_SPACING,
        startAngle: start + 2,
        endAngle: start + 58,
        labelScheme: 'numeric',
      },
      center,
      next,
    ), tier.end),
  ]
}

function tierSectors(next: NextKey, tier: Tier): SeatMapObject[] {
  const objects: SeatMapObject[] = []
  let number = tier.number * 100 + 1
  const label = (): string => String(number++)

  for (const x of SIDE_SECTORS) objects.push(...sideSector(next, tier, label(), x, true))
  for (const start of [-90, -30, 30]) objects.push(...endSector(next, tier, label(), RIGHT_END, start))
  for (const x of [...SIDE_SECTORS].reverse()) objects.push(...sideSector(next, tier, label(), x, false))
  for (const start of [90, 150, 210]) objects.push(...endSector(next, tier, label(), LEFT_END, start))

  return objects
}

function parterre(next: NextKey, label: string, x: number, price: PriceGroup): SeatMapObject[] {
  const zoneKey = next('zone')

  return [
    zone(zoneKey, label, 'Партер', rectPoints(x, 900, 260, 400)),
    ...priced(generateRows(
      { sectorKey: zoneKey, rows: 13, seatsPerRow: 10, seatSpacing: 24, rowSpacing: 28, labelScheme: 'numeric', curve: 0 },
      { x: x + 22, y: 930 },
      next,
    ), price),
  ]
}

export function icePalace(): StudioSchemeFile {
  const next = keyFactory()
  const fan: PriceGroup = { key: 'fan', name: 'Фан-зона', color: '#16a34a', price_amount: 250000 }
  const parter: PriceGroup = { key: 'parter', name: 'Партер', color: '#e11d48', price_amount: 600000 }
  const lowerSide: PriceGroup = { key: 'lower-side', name: 'Нижний ярус, трибуны', color: '#f59e0b', price_amount: 450000 }
  const lowerEnd: PriceGroup = { key: 'lower-end', name: 'Нижний ярус, виражи', color: '#8b5cf6', price_amount: 350000 }
  const upper: PriceGroup = { key: 'upper', name: 'Верхний ярус', color: '#2563eb', price_amount: 200000 }
  const objects: SeatMapObject[] = [
    floorArea(next, null, rectPoints(900, 800, 1200, 600), 200),
    ...admissionArea(next, 'Фан-зона', 'Фан-зона', rectPoints(1270, 870, 460, 460), fan, { x: 1500, y: CENTER_Y }),
    ...parterre(next, 'Партер A', 960, parter),
    ...parterre(next, 'Партер B', 1780, parter),
    ...tierSectors(next, { number: 1, group: 'Нижний ярус', zoneInner: 365, zoneOuter: 640, seatInner: 380, rows: 12, side: lowerSide, end: lowerEnd }),
    ...tierSectors(next, { number: 2, group: 'Верхний ярус', zoneInner: 665, zoneOuter: 940, seatInner: 680, rows: 12, side: upper, end: upper }),
  ]

  return studioFile('Пример: ледовый дворец', { width: 3000, height: 2200 }, [fan, parter, lowerSide, lowerEnd, upper], AUTO_DISPLAY, objects)
}
