// @vitest-environment node
/// <reference types="node" />
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { validateSeatMapScheme, type SeatMapObject } from '@fpass/seat-map/schema'
import { describe, expect, it } from 'vitest'

import { parseStudioSchemeFile, type StudioSchemeFile } from '../schemes/library'
import {
  buildExampleSchemes,
  buildLargeExampleSchemes,
  EXAMPLE_SCHEME_NAMES,
  type ExampleSchemeName,
  LARGE_EXAMPLE_SCHEME_NAMES,
  type LargeExampleSchemeName,
} from './exampleSchemes'

const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url))
const examples = { ...buildExampleSchemes(), ...buildLargeExampleSchemes() }
const ALL_NAMES = [...EXAMPLE_SCHEME_NAMES, ...LARGE_EXAMPLE_SCHEME_NAMES]

if (process.env.UPDATE_EXAMPLES === '1') {
  mkdirSync(EXAMPLES_DIR, { recursive: true })
  for (const name of ALL_NAMES) {
    writeFileSync(`${EXAMPLES_DIR}${name}.json`, `${JSON.stringify(examples[name])}\n`)
  }
}

const NEW_EXAMPLES = [
  'club-two-floors',
  'roof-terrace',
  'club-vip',
  'event-hall',
  'banquet-hall',
  'banquet-hall-tables',
  'concert-club',
  'ice-palace',
  'stadium',
] as const satisfies readonly (ExampleSchemeName | LargeExampleSchemeName)[]

function ofType(file: StudioSchemeFile, type: string): SeatMapObject[] {
  return file.objects.filter(object => object.type === type)
}

function seats(file: StudioSchemeFile): number {
  return ofType(file, 'seat').length
}

function sectorLabels(file: StudioSchemeFile): string[] {
  const used = new Set(file.objects.map(object => object.sector_key).filter(Boolean))

  return ofType(file, 'zone').filter(zone => used.has(zone.external_key)).map(zone => zone.label ?? '')
}

function wholeTables(file: StudioSchemeFile): SeatMapObject[] {
  return ofType(file, 'table').filter(table => table.style?.seat_group === 'whole_table')
}

function objectPoints(object: SeatMapObject): number[] {
  const points = object.style?.points

  if (Array.isArray(points)) return points.map(Number)
  if (object.rotation) return [object.x, object.y]

  return [object.x, object.y, object.x + (object.width ?? 0), object.y + (object.height ?? 0)]
}

describe('example schemes', () => {
  it.each(ALL_NAMES)('%s round-trips through the Studio JSON v2 contract', (name) => {
    expect(parseStudioSchemeFile(JSON.parse(JSON.stringify(examples[name])))).toEqual(examples[name])
  })

  it.each(ALL_NAMES)('%s matches the committed file', (name) => {
    const path = `${EXAMPLES_DIR}${name}.json`

    expect(existsSync(path)).toBe(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(examples[name])
  })

  it.each(ALL_NAMES)('%s has unique keys and seat sectors that reference zones', (name) => {
    const objects = examples[name].objects
    const keys = objects.map(object => object.external_key)
    const zones = new Set(objects.filter(object => object.type === 'zone').map(object => object.external_key))

    expect(new Set(keys).size).toBe(keys.length)
    for (const object of objects) {
      if (object.sector_key) expect(zones.has(object.sector_key)).toBe(true)
    }
  })

  it.each(ALL_NAMES)('%s passes the seat-map package validation without issues', (name) => {
    const file = examples[name]

    expect(validateSeatMapScheme({ schema_version: 2, canvas: file.schema_json.canvas, objects: file.objects })).toEqual([])
  })

  it.each(ALL_NAMES)('%s has unique sector names and prices from its own groups', (name) => {
    const file = examples[name]
    const labels = sectorLabels(file)
    const groups = new Set(file.schema_json.price_groups.map(group => group.key))

    expect(labels.every(label => label.trim() !== '')).toBe(true)
    expect(new Set(labels).size).toBe(labels.length)
    for (const object of file.objects) {
      if (object.price_group_key) expect(groups.has(object.price_group_key)).toBe(true)
    }
  })

  it.each(NEW_EXAMPLES)('%s is a Russian example in the «Примеры» group that stays within its canvas', (name) => {
    const file = examples[name]
    const { width, height } = file.schema_json.canvas

    expect(file.scheme.name.startsWith('Пример: ')).toBe(true)
    expect(file.scheme.group_name).toBe('Примеры')
    for (const object of file.objects) {
      const points = objectPoints(object)
      for (let index = 0; index < points.length; index += 2) {
        expect(points[index]).toBeGreaterThanOrEqual(0)
        expect(points[index]).toBeLessThanOrEqual(width)
        expect(points[index + 1]).toBeGreaterThanOrEqual(0)
        expect(points[index + 1]).toBeLessThanOrEqual(height)
      }
    }
  })

  it('covers increasing seat density', () => {
    expect(seats(examples['club-small'])).toBe(30)
    expect(seats(examples['restaurant-tables'])).toBe(48)
    expect(examples['restaurant-tables'].objects.some(object => object.type === 'zone')).toBe(false)
    expect(seats(examples.theatre)).toBeGreaterThan(500)
    expect(seats(examples.arena)).toBeGreaterThan(8000)
    expect(new Set(examples.arena.objects.filter(object => object.type === 'zone').map(object => object.sector_group)))
      .toEqual(new Set(['Первый ярус', 'Второй ярус', 'Танцпол']))
  })

  it('builds the club venues with dancefloors, tables and VIP sectors', () => {
    const twoFloors = examples['club-two-floors']
    expect(seats(twoFloors)).toBeGreaterThanOrEqual(55)
    expect(seats(twoFloors)).toBeLessThanOrEqual(70)
    expect(sectorLabels(twoFloors)).toEqual(['2 этаж', '1 этаж'])
    expect(ofType(twoFloors, 'dancefloor').map(object => object.label)).toEqual(['Танцпол'])

    const terrace = examples['roof-terrace']
    expect(sectorLabels(terrace)).toEqual(['VIP-балкон', 'Барная стойка', 'Нижняя терраса', 'Танцпол'])
    expect(wholeTables(terrace)).toHaveLength(14)
    expect(ofType(terrace, 'seat').filter(seat => seat.parent_external_key === null)).toHaveLength(40)

    const vip = examples['club-vip']
    expect(sectorLabels(vip)).toEqual(['Super VIP', 'VIP', 'Super VIP 2', 'VIP light', 'Танцпол'])
    expect(ofType(vip, 'table')).toHaveLength(18)
    expect(ofType(vip, 'dancefloor').map(object => [object.label, object.price])).toEqual([['VIP light', 300000], ['Танцпол', 380000]])

    const hall = examples['event-hall']
    expect(sectorLabels(hall)).toEqual(['VIP 1', 'VIP 2', 'Танцпол', 'Бэкстейдж'])
    expect(wholeTables(hall).map(table => table.sector_key)).toEqual(Array(4).fill(hall.objects.find(object => object.label === 'Бэкстейдж')?.external_key))
    expect(ofType(hall, 'bar')).toHaveLength(1)
  })

  it('builds the banquet hall with 45 tables sold per seat or whole', () => {
    const perSeat = examples['banquet-hall']
    const whole = examples['banquet-hall-tables']

    expect(ofType(perSeat, 'table')).toHaveLength(45)
    expect(ofType(perSeat, 'floor')).toHaveLength(1)
    expect(ofType(perSeat, 'bar')).toHaveLength(2)
    expect(ofType(perSeat, 'entrance').map(object => object.label)).toEqual(['Выход'])
    expect(ofType(perSeat, 'table').filter(table => table.rotation === 45).length).toBeGreaterThanOrEqual(15)
    expect(wholeTables(perSeat)).toHaveLength(0)
    expect(wholeTables(whole)).toHaveLength(45)
    expect(whole.schema_json.price_groups.map(group => group.price_amount)).toEqual([600000, 920000, 930000])
    expect(ofType(whole, 'seat').map(seat => [seat.x, seat.y])).toEqual(ofType(perSeat, 'seat').map(seat => [seat.x, seat.y]))
  })

  it('builds the concert club with table arcs, curved sectors and studio boxes', () => {
    const club = examples['concert-club']
    const tableLabels = ofType(club, 'table').map(table => table.label)

    expect(tableLabels).toHaveLength(20)
    expect(wholeTables(club)).toHaveLength(20)
    expect(tableLabels).toEqual(expect.arrayContaining(['1A', '5A', '1B', '5B', '10A', '10B']))
    expect(sectorLabels(club)).toEqual(expect.arrayContaining(['VIP без места', 'Сектор A', 'Сектор B', 'Студия W1', 'Студия W2', 'Студия B1', 'Студия W3', 'Танцпол']))
    for (const label of ['Сектор A', 'Сектор B']) {
      const key = club.objects.find(object => object.type === 'zone' && object.label === label)?.external_key
      expect(ofType(club, 'seat').filter(seat => seat.sector_key === key).length).toBeGreaterThanOrEqual(22)
    }
    expect(ofType(club, 'dancefloor')).toHaveLength(6)
    expect(club.schema_json.price_groups).toHaveLength(5)
  })

  it('builds the ice palace bowl with tiers around the rink', () => {
    const palace = examples['ice-palace']
    const zones = ofType(palace, 'zone')

    expect(seats(palace)).toBeGreaterThanOrEqual(5500)
    expect(seats(palace)).toBeLessThanOrEqual(7000)
    expect(sectorLabels(palace).length).toBeGreaterThanOrEqual(24)
    expect(sectorLabels(palace).length).toBeLessThanOrEqual(30)
    expect(new Set(zones.map(zone => zone.sector_group))).toEqual(new Set(['Нижний ярус', 'Верхний ярус', 'Партер', 'Фан-зона']))
    expect(ofType(palace, 'dancefloor').map(object => object.label)).toEqual(['Фан-зона'])
    expect(palace.schema_json.display?.section_contents).toBe('auto')
  })

  it('builds the stadium with four two-tier stands around the pitch', () => {
    const stadium = examples.stadium
    const groups = new Set(ofType(stadium, 'zone').map(zone => zone.sector_group))

    expect(seats(stadium)).toBeGreaterThanOrEqual(11000)
    expect(seats(stadium)).toBeLessThanOrEqual(13000)
    expect(sectorLabels(stadium)).toHaveLength(40)
    expect(groups.size).toBe(8)
    for (const stand of ['Запад', 'Восток', 'Север', 'Юг']) {
      expect([...groups].filter(group => group?.startsWith(stand))).toHaveLength(2)
    }
    expect(ofType(stadium, 'floor').map(object => object.label)).toEqual(['Поле'])
    expect(stadium.schema_json.price_groups).toHaveLength(4)
    expect(stadium.schema_json.display?.section_contents).toBe('auto')
  })

  it('keeps multi-megabyte examples out of the auto-loaded list', () => {
    expect(EXAMPLE_SCHEME_NAMES).not.toContain('ice-palace')
    expect(EXAMPLE_SCHEME_NAMES).not.toContain('stadium')
    for (const name of LARGE_EXAMPLE_SCHEME_NAMES) {
      expect(JSON.stringify(examples[name]).length).toBeGreaterThan(1024 * 1024)
    }
  })

  it('keeps the arena under the 5 MB admin upload limit', () => {
    expect(JSON.stringify(examples.arena).length).toBeLessThan(5 * 1024 * 1024)
  })

  it('keeps the stadium file under 4.5 MB', () => {
    expect(Buffer.byteLength(`${JSON.stringify(examples.stadium)}\n`)).toBeLessThan(4.5 * 1024 * 1024)
  })
})
