// @vitest-environment node
/// <reference types="node" />
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseStudioSchemeFile, type StudioSchemeFile } from '../schemes/library'
import { buildExampleSchemes, EXAMPLE_SCHEME_NAMES } from './exampleSchemes'

const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url))
const examples = buildExampleSchemes()

if (process.env.UPDATE_EXAMPLES === '1') {
  mkdirSync(EXAMPLES_DIR, { recursive: true })
  for (const name of EXAMPLE_SCHEME_NAMES) {
    writeFileSync(`${EXAMPLES_DIR}${name}.json`, `${JSON.stringify(examples[name])}\n`)
  }
}

function seats(file: StudioSchemeFile): number {
  return file.objects.filter(object => object.type === 'seat').length
}

describe('example schemes', () => {
  it.each(EXAMPLE_SCHEME_NAMES)('%s round-trips through the Studio JSON v2 contract', (name) => {
    expect(parseStudioSchemeFile(JSON.parse(JSON.stringify(examples[name])))).toEqual(examples[name])
  })

  it.each(EXAMPLE_SCHEME_NAMES)('%s matches the committed file', (name) => {
    const path = `${EXAMPLES_DIR}${name}.json`

    expect(existsSync(path)).toBe(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(examples[name])
  })

  it.each(EXAMPLE_SCHEME_NAMES)('%s has unique keys and seat sectors that reference zones', (name) => {
    const objects = examples[name].objects
    const keys = objects.map(object => object.external_key)
    const zones = new Set(objects.filter(object => object.type === 'zone').map(object => object.external_key))

    expect(new Set(keys).size).toBe(keys.length)
    for (const object of objects) {
      if (object.sector_key) expect(zones.has(object.sector_key)).toBe(true)
    }
  })

  it('covers increasing seat density', () => {
    expect(seats(examples['club-small'])).toBe(30)
    expect(seats(examples['restaurant-tables'])).toBe(48)
    expect(examples['restaurant-tables'].objects.some(object => object.type === 'zone')).toBe(false)
    expect(seats(examples.theatre)).toBeGreaterThan(500)
    expect(seats(examples.arena)).toBeGreaterThan(8000)
    expect(new Set(examples.arena.objects.filter(object => object.type === 'zone').map(object => object.sector_group)))
      .toEqual(new Set(['Первый ярус', 'Второй ярус']))
  })

  it('keeps the arena under the 5 MB admin upload limit', () => {
    expect(JSON.stringify(examples.arena).length).toBeLessThan(5 * 1024 * 1024)
  })
})
