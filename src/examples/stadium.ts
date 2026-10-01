import { generateRows } from '@fpass/seat-map/editor'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  AUTO_DISPLAY,
  floorArea,
  keyFactory,
  type NextKey,
  type Point,
  type PriceGroup,
  priced,
  rectPoints,
  rotateObjects,
  rotatePoints,
  studioFile,
  zone,
} from './helpers'

const CENTER: Point = { x: 1200, y: 1450 }
const PITCH = { width: 900, height: 1400 }
const SEAT_SPACING = 18
const ROW_SPACING = 20
const ROWS = 15

interface Stand {
  name: string
  rotation: number
  depth: number
  lowerHalf: number
  upperHalf: number
  lowerPrice: PriceGroup
  upperPrice: PriceGroup
}

interface Tier {
  number: number
  title: string
  offset: number
}

const TIERS: Tier[] = [
  { number: 1, title: 'нижний ярус', offset: 50 },
  { number: 2, title: 'верхний ярус', offset: 390 },
]

function sector(next: NextKey, stand: Stand, tier: Tier, label: string, from: number, to: number, price: PriceGroup): SeatMapObject[] {
  const zoneKey = next('zone')
  const top = CENTER.y + stand.depth + tier.offset
  const seatsPerRow = Math.floor((to - from - 24) / SEAT_SPACING) + 1
  const firstX = CENTER.x + (from + to) / 2 - ((seatsPerRow - 1) * SEAT_SPACING) / 2
  const seats = generateRows(
    { sectorKey: zoneKey, rows: ROWS, seatsPerRow, seatSpacing: SEAT_SPACING, rowSpacing: ROW_SPACING, labelScheme: 'numeric', curve: 0 },
    { x: firstX, y: top + 10 },
    next,
  )

  return [
    zone(zoneKey, label, `${stand.name}, ${tier.title}`, rotatePoints(rectPoints(CENTER.x + from + 4, top, to - from - 8, 300), CENTER, stand.rotation)),
    ...priced(rotateObjects(seats, CENTER, stand.rotation), price),
  ]
}

function standSectors(next: NextKey, stand: Stand, tier: Tier, firstNumber: number): SeatMapObject[] {
  const half = tier.number === 1 ? stand.lowerHalf : stand.upperHalf
  const price = tier.number === 1 ? stand.lowerPrice : stand.upperPrice
  const width = (half * 2) / 5

  return Array.from({ length: 5 }, (_, index) => sector(
    next,
    stand,
    tier,
    String(firstNumber + index),
    -half + index * width,
    -half + (index + 1) * width,
    price,
  )).flat()
}

export function stadium(): StudioSchemeFile {
  const next = keyFactory()
  const centralLower: PriceGroup = { key: 'a', name: 'Запад/Восток, нижний', color: '#e11d48', price_amount: 300000 }
  const endLower: PriceGroup = { key: 'b', name: 'Север/Юг, нижний', color: '#f59e0b', price_amount: 200000 }
  const centralUpper: PriceGroup = { key: 'c', name: 'Запад/Восток, верхний', color: '#16a34a', price_amount: 150000 }
  const endUpper: PriceGroup = { key: 'd', name: 'Север/Юг, верхний', color: '#2563eb', price_amount: 100000 }
  const halfWidth = PITCH.width / 2
  const halfHeight = PITCH.height / 2
  const stands: Stand[] = [
    { name: 'Запад', rotation: 90, depth: halfWidth, lowerHalf: halfHeight, upperHalf: halfHeight + 350, lowerPrice: centralLower, upperPrice: centralUpper },
    { name: 'Север', rotation: 180, depth: halfHeight, lowerHalf: halfWidth + 350, upperHalf: halfWidth + 690, lowerPrice: endLower, upperPrice: endUpper },
    { name: 'Восток', rotation: 270, depth: halfWidth, lowerHalf: halfHeight, upperHalf: halfHeight + 350, lowerPrice: centralLower, upperPrice: centralUpper },
    { name: 'Юг', rotation: 0, depth: halfHeight, lowerHalf: halfWidth + 350, upperHalf: halfWidth + 690, lowerPrice: endLower, upperPrice: endUpper },
  ]
  const objects: SeatMapObject[] = [floorArea(next, 'Поле', rectPoints(CENTER.x - halfWidth, CENTER.y - halfHeight, PITCH.width, PITCH.height), 4)]

  for (const tier of TIERS) {
    stands.forEach((stand, index) => objects.push(...standSectors(next, stand, tier, tier.number * 100 + index * 5 + 1)))
  }

  return studioFile('Пример: стадион', { width: 2400, height: 2900 }, [centralLower, endLower, centralUpper, endUpper], AUTO_DISPLAY, objects)
}
