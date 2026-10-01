import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearStudioSchemes,
  createStudioScheme,
  loadStudioSchemes,
  parseStoredStudioScheme,
  parseStudioSchemeFile,
  saveStudioSchemes,
} from './library'

const FORMAT_ERROR = 'Поддерживается JSON-схема FPass версии 2.'

function validFile(): Record<string, unknown> {
  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme: {
      name: 'Главный зал',
      group_name: 'Театры',
    },
    schema_json: {
      canvas: {
        width: 1200,
        height: 800,
        background: '#ffffff',
      },
      price_groups: [
        {
          key: 'vip',
          name: 'VIP',
          color: '#e11d48',
          price_amount: 500000,
        },
      ],
      sections: [],
    },
    objects: [
      {
        external_key: 'dancefloor',
        type: 'dancefloor',
        label: 'Танцпол',
        x: 10,
        y: 20,
      },
    ],
  }
}

describe('studio scheme document library', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists two named documents independently', () => {
    const first = createStudioScheme('Партер')
    saveStudioSchemes([first])

    const second = createStudioScheme('Балкон')
    saveStudioSchemes([...loadStudioSchemes(), second])

    const stored = loadStudioSchemes()

    expect(stored.map(({ file }) => file.scheme.name)).toEqual(['Партер', 'Балкон'])
    expect(stored[0].id).not.toBe(stored[1].id)

    stored[0].file.scheme.name = 'Партер обновлён'
    saveStudioSchemes(stored)

    expect(loadStudioSchemes().map(({ file }) => file.scheme.name)).toEqual([
      'Партер обновлён',
      'Балкон',
    ])
  })

  it('parses the exact FPass JSON v2 envelope', () => {
    expect(parseStudioSchemeFile(validFile())).toEqual(validFile())
  })

  it('returns a trimmed canonical scheme identity', () => {
    const file = validFile()
    file.scheme = {
      name: '  Главный зал  ',
      group_name: '  Театры  ',
    }

    expect(parseStudioSchemeFile(file).scheme).toEqual({
      name: 'Главный зал',
      group_name: 'Театры',
    })

    file.scheme = {
      name: 'Главный зал',
      group_name: '   ',
    }

    expect(parseStudioSchemeFile(file).scheme.group_name).toBeNull()
  })

  it('accepts the default name and a 255 Unicode-code-point identity', () => {
    const file = validFile()
    file.scheme = {
      name: '🎭'.repeat(255),
      group_name: 'Ж'.repeat(255),
    }

    expect(parseStudioSchemeFile(file).scheme).toEqual(file.scheme)
    expect(parseStudioSchemeFile(createStudioScheme().file).scheme.name).toBe('Новая схема')
  })

  it.each([
    ['a blank scheme name', '   ', null],
    ['a name over 255 Unicode code points', '🎭'.repeat(256), null],
    ['a group over 255 Unicode code points', 'Главный зал', '🎭'.repeat(256)],
  ])('rejects %s', (_caseName, name, groupName) => {
    const file = validFile()
    file.scheme = {
      name,
      group_name: groupName,
    }

    expect(() => parseStudioSchemeFile(file)).toThrowError(FORMAT_ERROR)
  })

  it.each([
    ['a malformed price group', () => {
      const file = validFile()
      file.schema_json = {
        canvas: { width: 1200, height: 800 },
        price_groups: [null],
        sections: [],
      }
      return file
    }],
    ['a malformed geometry object', () => ({ ...validFile(), objects: [null] })],
  ])('rejects %s instead of casting malformed array members', (_caseName, makeValue) => {
    expect(() => parseStudioSchemeFile(makeValue())).toThrowError(FORMAT_ERROR)
  })

  it('parses one stored document and rejects a malformed record', () => {
    const valid = createStudioScheme('Партер')
    const legacy = { ...valid, file: { ...valid.file, objects: [{ external_key: 'f', type: 'dancefloor', label: 'Т', x: 1, y: 2, capacity: 5 }] } }

    expect(parseStoredStudioScheme(valid)).toEqual(valid)
    expect(parseStoredStudioScheme(legacy)?.file.objects).toEqual([{ external_key: 'f', type: 'dancefloor', label: 'Т', x: 1, y: 2 }])
    expect(parseStoredStudioScheme({ ...valid, extra: true })).toBeNull()
    expect(parseStoredStudioScheme({ ...valid, file: { ...valid.file, objects: [null] } })).toBeNull()
    expect(parseStoredStudioScheme(null)).toBeNull()
  })

  it('clears the stored library key', () => {
    saveStudioSchemes([createStudioScheme('Партер')])

    clearStudioSchemes()

    expect(localStorage.getItem('fpass-scheme-studio:documents:v2')).toBeNull()
  })

  it('keeps valid documents when another stored document is corrupt', () => {
    const valid = createStudioScheme('Партер')
    const corruptSource = createStudioScheme('Повреждённая схема')
    const corrupt = {
      ...corruptSource,
      file: {
        ...corruptSource.file,
        objects: [null],
      },
    }

    localStorage.setItem(
      'fpass-scheme-studio:documents:v2',
      JSON.stringify([valid, corrupt]),
    )

    expect(loadStudioSchemes()).toEqual([valid])
  })

  it.each([
    ['a non-positive canvas dimension', () => {
      const file = validFile()
      file.schema_json = {
        canvas: { width: 0, height: 800 },
        price_groups: [],
        sections: [],
      }
      return file
    }],
    ['a non-finite canvas dimension', () => {
      const file = validFile()
      file.schema_json = {
        canvas: { width: 1200, height: Number.POSITIVE_INFINITY },
        price_groups: [],
        sections: [],
      }
      return file
    }],
    ['a non-array objects value', () => ({ ...validFile(), objects: {} })],
    ['a non-array price_groups value', () => {
      const file = validFile()
      file.schema_json = {
        canvas: { width: 1200, height: 800 },
        price_groups: {},
        sections: [],
      }
      return file
    }],
    ['non-empty sections', () => {
      const file = validFile()
      file.schema_json = {
        canvas: { width: 1200, height: 800 },
        price_groups: [],
        sections: [{ key: 'legacy' }],
      }
      return file
    }],
    ['legacy object capacity', () => {
      const file = validFile()
      file.objects = [{
        external_key: 'dancefloor',
        type: 'dancefloor',
        label: 'Танцпол',
        x: 10,
        y: 20,
        capacity: 100,
      }]
      return file
    }],
    ['embedded offers', () => ({ ...validFile(), offers: [] })],
    ['embedded packages', () => ({ ...validFile(), packages: [] })],
  ])('rejects %s with the v2 format error', (_caseName, makeValue) => {
    expect(() => parseStudioSchemeFile(makeValue())).toThrowError(FORMAT_ERROR)
  })

  type MutableFile = { schema_json: Record<string, unknown>; objects: Record<string, unknown>[] }

  function mutableFile(): MutableFile {
    return validFile() as unknown as MutableFile
  }

  it('keeps optional display settings and trimmed sector tiers', () => {
    const file = mutableFile()
    file.schema_json.display = { section_contents: 'after_zoom', sector_price_labels: true }
    file.objects.push({ external_key: 'zone-1', type: 'zone', label: 'Сектор 101', sector_group: '  Первый ярус ', x: 0, y: 0 })

    const parsed = parseStudioSchemeFile(file)

    expect(parsed.schema_json.display).toEqual({ section_contents: 'after_zoom', sector_price_labels: true })
    expect(parsed.objects[1]?.sector_group).toBe('Первый ярус')
  })

  it('omits display when the file has none and accepts a null tier on any object', () => {
    const file = mutableFile()
    file.objects.push({ external_key: 'seat-1', type: 'seat', label: null, sector_group: null, x: 0, y: 0 })

    const parsed = parseStudioSchemeFile(file)

    expect(parsed.schema_json).not.toHaveProperty('display')
    expect(parsed.objects[1]?.sector_group).toBeNull()
  })

  it.each([
    ['unknown display mode', (file: MutableFile) => { file.schema_json.display = { section_contents: 'zoom', sector_price_labels: false } }],
    ['display without the price label flag', (file: MutableFile) => { file.schema_json.display = { section_contents: 'auto' } }],
    ['an extra display key', (file: MutableFile) => { file.schema_json.display = { section_contents: 'auto', sector_price_labels: false, minimap: true } }],
    ['a sector tier on a seat', (file: MutableFile) => { file.objects.push({ external_key: 's', type: 'seat', label: null, sector_group: 'Ярус', x: 0, y: 0 }) }],
    ['a blank sector tier', (file: MutableFile) => { file.objects.push({ external_key: 'z', type: 'zone', label: null, sector_group: '  ', x: 0, y: 0 }) }],
    ['a sector tier over 255 code points', (file: MutableFile) => { file.objects.push({ external_key: 'z', type: 'zone', label: null, sector_group: 'Я'.repeat(256), x: 0, y: 0 }) }],
  ])('rejects %s', (_name, mutate) => {
    const file = mutableFile()
    mutate(file)

    expect(() => parseStudioSchemeFile(file)).toThrow(FORMAT_ERROR)
  })
})
