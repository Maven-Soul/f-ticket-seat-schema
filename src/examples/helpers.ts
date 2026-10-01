import { generateRectTable, generateRoundTable, type RectTableConfig } from '@fpass/seat-map/editor'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'

export type PriceGroup = SeatMapPricingGroupOption
export type Point = { x: number; y: number }
export type NextKey = (type: string) => string

export const AUTO_DISPLAY: SeatMapDisplaySettings = { section_contents: 'auto', sector_price_labels: false }

export function keyFactory(): NextKey {
  const counters = new Map<string, number>()

  return (type) => {
    const value = (counters.get(type) ?? 0) + 1
    counters.set(type, value)

    return `${type}-${value}`
  }
}

export function round(value: number): number {
  return Math.round(value * 10) / 10
}

export function priced(objects: SeatMapObject[], group: PriceGroup): SeatMapObject[] {
  return objects.map((object) => {
    const rounded = { ...object, x: round(object.x), y: round(object.y) }

    return object.type === 'seat'
      ? { ...rounded, color: group.color, price: group.price_amount, price_group_key: group.key }
      : rounded
  })
}

export function soldWhole(objects: SeatMapObject[], group: PriceGroup): SeatMapObject[] {
  return objects.map((object) => {
    const rounded = { ...object, x: round(object.x), y: round(object.y) }

    return object.type === 'table'
      ? {
          ...rounded,
          style: { ...object.style, seat_group: 'whole_table' },
          color: group.color,
          price: group.price_amount,
          price_group_key: group.key,
        }
      : rounded
  })
}

export function sold(objects: SeatMapObject[], group: PriceGroup, whole: boolean): SeatMapObject[] {
  return whole ? soldWhole(objects, group) : priced(objects, group)
}

export function rectPoints(x: number, y: number, width: number, height: number): number[] {
  return [x, y, x + width, y, x + width, y + height, x, y + height]
}

export function ringPoints(center: Point, inner: number, outer: number, startAngle: number, endAngle: number, segments = 12): number[] {
  const points: number[] = []
  const at = (radius: number, angle: number): void => {
    const radians = (angle * Math.PI) / 180
    points.push(round(center.x + Math.cos(radians) * radius), round(center.y + Math.sin(radians) * radius))
  }

  for (let index = 0; index <= segments; index++) at(outer, startAngle + ((endAngle - startAngle) * index) / segments)
  for (let index = segments; index >= 0; index--) at(inner, startAngle + ((endAngle - startAngle) * index) / segments)

  return points
}

export function regularPolygonPoints(center: Point, radius: number, sides: number, startAngle = 0): number[] {
  return Array.from({ length: sides }, (_, index) => {
    const radians = ((startAngle + (360 * index) / sides) * Math.PI) / 180

    return [round(center.x + Math.cos(radians) * radius), round(center.y + Math.sin(radians) * radius)]
  }).flat()
}

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  const dx = point.x - center.x
  const dy = point.y - center.y

  return {
    x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

export function rotatePoints(points: number[], center: Point, degrees: number): number[] {
  const rotated: number[] = []
  for (let index = 0; index < points.length; index += 2) {
    const point = rotatePoint({ x: points[index], y: points[index + 1] }, center, degrees)
    rotated.push(round(point.x), round(point.y))
  }

  return rotated
}

export function rotateObjects(objects: SeatMapObject[], center: Point, degrees: number): SeatMapObject[] {
  return objects.map(object => ({ ...object, ...rotatePoint(object, center, degrees) }))
}

export function zone(key: string, label: string, group: string | null, points: number[]): SeatMapObject {
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

export function block(key: string, label: string, x: number, y: number, width: number, height: number): SeatMapObject {
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

export function primitive(next: NextKey, type: 'bar' | 'entrance' | 'text', label: string | null, x: number, y: number, width: number, height: number): SeatMapObject {
  return { ...block(next(type), label ?? '', x, y, width, height), type, label, color: '#94a3b8' }
}

export function floorArea(next: NextKey, label: string | null, points: number[], cornerRadius = 16): SeatMapObject {
  return {
    ...zone(next('floor'), label ?? '', null, points),
    type: 'floor',
    label,
    sector_group: null,
    z_index: -10,
    style: { points, fill: '#ffffff', cornerRadius },
  }
}

export function admissionArea(next: NextKey, label: string, group: string, points: number[], price: PriceGroup, center: Point): SeatMapObject[] {
  const zoneKey = next('zone')

  return [
    zone(zoneKey, label, group, points),
    {
      external_key: next('dancefloor'),
      type: 'dancefloor',
      label,
      sector_key: zoneKey,
      x: center.x,
      y: center.y,
      width: null,
      height: null,
      rotation: 0,
      z_index: 4,
      style: { radius: 8 },
      color: price.color,
      price: price.price_amount,
      price_group_key: price.key,
    },
  ]
}

export function dancefloorArea(next: NextKey, x: number, y: number, width: number, height: number, group: PriceGroup): SeatMapObject[] {
  return admissionArea(next, 'Танцпол', 'Танцпол', rectPoints(x, y, width, height), group, { x: x + width / 2, y: y + height / 2 })
}

function relabelTable(objects: SeatMapObject[], label: string): SeatMapObject[] {
  return objects.map(object => object.type === 'table'
    ? { ...object, label }
    : { ...object, row: `Стол ${label}` })
}

export function roundTable(next: NextKey, sectorKey: string, seats: number, radius: number, center: Point, label: string): SeatMapObject[] {
  return relabelTable(generateRoundTable({ sectorKey, seats, tableRadius: radius }, center, next, 0), label)
}

export function rectTable(next: NextKey, config: RectTableConfig, center: Point, label: string, rotation = 0): SeatMapObject[] {
  const objects = relabelTable(generateRectTable(config, center, next, 0), label)
  if (rotation === 0) return objects

  return objects.map((object) => {
    if (object.type !== 'table') return { ...object, ...rotatePoint(object, center, rotation) }

    const corner = rotatePoint({ x: center.x - (object.width ?? 0) / 2, y: center.y - (object.height ?? 0) / 2 }, center, rotation)

    return { ...object, ...corner, rotation }
  })
}

export function studioFile(
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
