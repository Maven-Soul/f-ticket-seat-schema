import {
  generateConcentricRows,
  generateRectTable,
  generateRoundTable,
  generateRows,
} from '@fpass/seat-map/editor'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'

export const EXAMPLE_SCHEME_NAMES = ['club-small', 'restaurant-tables', 'theatre', 'arena'] as const
export type ExampleSchemeName = typeof EXAMPLE_SCHEME_NAMES[number]

type PriceGroup = SeatMapPricingGroupOption
type Point = { x: number; y: number }

function keyFactory(): (type: string) => string {
  const counters = new Map<string, number>()

  return (type) => {
    const value = (counters.get(type) ?? 0) + 1
    counters.set(type, value)

    return `${type}-${value}`
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function priced(objects: SeatMapObject[], group: PriceGroup): SeatMapObject[] {
  return objects.map((object) => {
    const rounded = { ...object, x: round(object.x), y: round(object.y) }

    return object.type === 'seat'
      ? { ...rounded, color: group.color, price: group.price_amount, price_group_key: group.key }
      : rounded
  })
}

function rectPoints(x: number, y: number, width: number, height: number): number[] {
  return [x, y, x + width, y, x + width, y + height, x, y + height]
}

function ringPoints(center: Point, inner: number, outer: number, startAngle: number, endAngle: number, segments = 12): number[] {
  const points: number[] = []
  const at = (radius: number, angle: number): void => {
    const radians = (angle * Math.PI) / 180
    points.push(round(center.x + Math.cos(radians) * radius), round(center.y + Math.sin(radians) * radius))
  }

  for (let index = 0; index <= segments; index++) at(outer, startAngle + ((endAngle - startAngle) * index) / segments)
  for (let index = segments; index >= 0; index--) at(inner, startAngle + ((endAngle - startAngle) * index) / segments)

  return points
}

function zone(key: string, label: string, group: string | null, points: number[]): SeatMapObject {
  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)

  return {
    external_key: key,
    type: 'zone',
    label,
    sector_group: group,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: null,
    height: null,
    rotation: 0,
    z_index: -5,
    style: { points, fill: 'rgba(255,255,255,0.01)', stroke: 'transparent', strokeWidth: 0, cornerRadius: 14 },
    color: '#64748b',
    price: null,
    price_group_key: null,
  }
}

function block(key: string, label: string, x: number, y: number, width: number, height: number): SeatMapObject {
  return {
    external_key: key,
    type: 'stage',
    label,
    x,
    y,
    width,
    height,
    rotation: 0,
    z_index: 1,
    style: null,
    color: '#64748b',
  }
}

function dancefloorArea(next: (type: string) => string, x: number, y: number, width: number, height: number, group: PriceGroup): SeatMapObject[] {
  const zoneKey = next('zone')

  return [
    zone(zoneKey, 'Танцпол', 'Танцпол', rectPoints(x, y, width, height)),
    {
      external_key: next('dancefloor'),
      type: 'dancefloor',
      label: 'Танцпол',
      sector_key: zoneKey,
      x: x + width / 2,
      y: y + height / 2,
      width: null,
      height: null,
      rotation: 0,
      z_index: 4,
      style: { radius: 8 },
      color: group.color,
      price: group.price_amount,
      price_group_key: group.key,
    },
  ]
}

function studioFile(
  name: string,
  canvas: { width: number; height: number },
  priceGroups: PriceGroup[],
  display: SeatMapDisplaySettings | null,
  objects: SeatMapObject[],
): StudioSchemeFile {
  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme: { name, group_name: 'Примеры' },
    schema_json: {
      canvas: { ...canvas, background: '#ffffff' },
      price_groups: priceGroups,
      sections: [],
      ...(display ? { display } : {}),
    },
    objects,
  }
}

function clubSmall(): StudioSchemeFile {
  const next = keyFactory()
  const standard: PriceGroup = { key: 'standard', name: 'Стандарт', color: '#2563eb', price_amount: 150000 }
  const vip: PriceGroup = { key: 'vip', name: 'VIP', color: '#e11d48', price_amount: 300000 }
  const objects: SeatMapObject[] = [
    block(next('stage'), 'Сцена', 300, 40, 400, 80),
    ...dancefloorArea(next, 300, 160, 400, 220, standard),
  ]

  for (const [label, x, group] of [['Ложа A', 80, vip], ['Ложа B', 400, standard], ['Ложа C', 720, vip]] as const) {
    const zoneKey = next('zone')
    objects.push(zone(zoneKey, label, 'Ложи', rectPoints(x - 20, 440, 200, 110)))
    objects.push(...priced(generateRows(
      { sectorKey: zoneKey, rows: 2, seatsPerRow: 5, seatSpacing: 36, rowSpacing: 40, labelScheme: 'cyrillic', curve: 0 },
      { x: x + 8, y: 475 },
      next,
    ), group))
  }

  return studioFile('Пример: клуб, 3 ложи', { width: 1000, height: 620 }, [standard, vip], { section_contents: 'auto', sector_price_labels: false }, objects)
}

function restaurantTables(): StudioSchemeFile {
  const next = keyFactory()
  const standard: PriceGroup = { key: 'standard', name: 'Зал', color: '#2563eb', price_amount: 250000 }
  const vip: PriceGroup = { key: 'vip', name: 'VIP', color: '#e11d48', price_amount: 450000 }
  const objects: SeatMapObject[] = [block(next('stage'), 'Сцена', 350, 30, 300, 70)]

  for (let index = 0; index < 4; index++) {
    objects.push(...priced(generateRoundTable({ sectorKey: '', seats: 6, tableRadius: 36 }, { x: 170 + index * 220, y: 220 }, next, index + 1), standard))
    objects.push(...priced(generateRectTable({ sectorKey: '', seatsTop: 2, seatsBottom: 2, seatsLeft: 1, seatsRight: 1 }, { x: 170 + index * 220, y: 440 }, next, index + 5), vip))
  }

  return studioFile('Пример: ресторан со столами', { width: 1000, height: 600 }, [standard, vip], null, objects)
}

function theatre(): StudioSchemeFile {
  const next = keyFactory()
  const parter: PriceGroup = { key: 'parter', name: 'Партер', color: '#e11d48', price_amount: 350000 }
  const amphitheatre: PriceGroup = { key: 'amphitheatre', name: 'Амфитеатр', color: '#f59e0b', price_amount: 250000 }
  const balcony: PriceGroup = { key: 'balcony', name: 'Балкон', color: '#2563eb', price_amount: 150000 }
  const center = { x: 700, y: 100 }
  const objects: SeatMapObject[] = [block(next('stage'), 'Сцена', 450, 60, 500, 90)]

  const parterKey = next('zone')
  objects.push(zone(parterKey, 'Партер', 'Нижний уровень', rectPoints(380, 180, 640, 380)))
  objects.push(...priced(generateRows(
    { sectorKey: parterKey, rows: 12, seatsPerRow: 24, seatSpacing: 26, rowSpacing: 28, labelScheme: 'cyrillic', curve: 18 },
    { x: 401, y: 200 },
    next,
  ), parter))

  const amphitheatreKey = next('zone')
  objects.push(zone(amphitheatreKey, 'Амфитеатр', 'Нижний уровень', ringPoints(center, 540, 800, 58, 122)))
  objects.push(...priced(generateConcentricRows(
    {
      sectorKey: amphitheatreKey,
      rows: 8,
      seatsPerRow: [26, 27, 28, 29, 30, 31, 32, 33],
      innerRadius: 560,
      rowSpacing: 30,
      startAngle: 62,
      endAngle: 118,
      labelScheme: 'numeric',
    },
    center,
    next,
  ), amphitheatre))

  const balconyKey = next('zone')
  objects.push(zone(balconyKey, 'Балкон', 'Верхний уровень', rectPoints(300, 930, 800, 140)))
  objects.push(...priced(generateRows(
    { sectorKey: balconyKey, rows: 4, seatsPerRow: 30, seatSpacing: 26, rowSpacing: 30, labelScheme: 'cyrillic', curve: 0 },
    { x: 323, y: 955 },
    next,
  ), balcony))

  return studioFile('Пример: театр', { width: 1400, height: 1100 }, [parter, amphitheatre, balcony], { section_contents: 'auto', sector_price_labels: false }, objects)
}

function arena(): StudioSchemeFile {
  const next = keyFactory()
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 330000 }
  const lowerSide: PriceGroup = { key: 'lower-side', name: 'Первый ярус, бока', color: '#e11d48', price_amount: 480000 }
  const lowerEnd: PriceGroup = { key: 'lower-end', name: 'Первый ярус, торцы', color: '#f59e0b', price_amount: 360000 }
  const upper: PriceGroup = { key: 'upper', name: 'Второй ярус', color: '#2563eb', price_amount: 270000 }
  const center = { x: 1400, y: 1400 }
  const spacing = 20
  const objects: SeatMapObject[] = [
    block(next('stage'), 'Сцена', 1200, 1030, 400, 80),
    ...dancefloorArea(next, 1120, 1130, 560, 450, dance),
  ]
  const tiers = [
    { prefix: 1, group: 'Первый ярус', zoneInner: 500, zoneOuter: 860, seatInner: 520, rows: 17 },
    { prefix: 2, group: 'Второй ярус', zoneInner: 900, zoneOuter: 1340, seatInner: 920, rows: 21 },
  ]

  for (const tier of tiers) {
    for (let index = 0; index < 24; index++) {
      const start = index * 15
      const middle = ((start + 7.5) * Math.PI) / 180
      const price = tier.prefix === 2 ? upper : Math.abs(Math.sin(middle)) > 0.7 ? lowerSide : lowerEnd
      const zoneKey = next('zone')
      const seatSweep = ((15 - 3) * Math.PI) / 180
      const seatsPerRow = Array.from(
        { length: tier.rows },
        (_, row) => Math.max(1, Math.floor(((tier.seatInner + row * spacing) * seatSweep) / spacing)),
      )

      objects.push(zone(zoneKey, String(tier.prefix * 100 + index + 1), tier.group, ringPoints(center, tier.zoneInner, tier.zoneOuter, start + 0.75, start + 14.25)))
      objects.push(...priced(generateConcentricRows(
        {
          sectorKey: zoneKey,
          rows: tier.rows,
          seatsPerRow,
          innerRadius: tier.seatInner,
          rowSpacing: spacing,
          startAngle: start + 1.5,
          endAngle: start + 13.5,
          labelScheme: 'numeric',
        },
        center,
        next,
      ), price))
    }
  }

  return studioFile('Пример: арена, 2 яруса', { width: 2800, height: 2800 }, [dance, lowerSide, lowerEnd, upper], { section_contents: 'auto', sector_price_labels: true }, objects)
}

export function buildExampleSchemes(): Record<ExampleSchemeName, StudioSchemeFile> {
  return {
    'club-small': clubSmall(),
    'restaurant-tables': restaurantTables(),
    theatre: theatre(),
    arena: arena(),
  }
}
