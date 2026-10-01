import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SeatMapObject } from '@fpass/seat-map/schema'

import { EXAMPLE_SCHEME_NAMES } from '../examples/exampleSchemes'
import { createStudioScheme, loadStudioSchemes, saveStudioSchemes, type StudioSchemeFile } from './library'
import { resetSchemeLibrary, useSchemeLibrary } from './useSchemeLibrary'

const STORAGE_KEY = 'fpass-scheme-studio:documents:v2'

class FailingStorage implements Storage {
  constructor(private readonly backing: Storage, private readonly failure: 'read' | 'write') {}

  get length(): number {
    return this.backing.length
  }

  clear(): void {
    this.backing.clear()
  }

  getItem(key: string): string | null {
    if (this.failure === 'read') throw new DOMException('denied', 'SecurityError')
    return this.backing.getItem(key)
  }

  key(index: number): string | null {
    return this.backing.key(index)
  }

  removeItem(key: string): void {
    this.backing.removeItem(key)
  }

  setItem(key: string, value: string): void {
    if (this.failure === 'write') throw new DOMException('Quota exceeded', 'QuotaExceededError')
    this.backing.setItem(key, value)
  }
}

function jsonFile(value: unknown): File {
  return new File([JSON.stringify(value)], 'scheme.json', { type: 'application/json' })
}

function withObjects(name: string): StudioSchemeFile {
  const file = createStudioScheme(name).file
  return {
    ...file,
    scheme: { name, group_name: 'Театры' },
    objects: [{ external_key: 'seat-1', type: 'seat', label: '1', x: 10, y: 20 }],
  }
}

describe('useSchemeLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSchemeLibrary()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetSchemeLibrary()
  })

  it('shares one state between callers', () => {
    const first = useSchemeLibrary()
    const created = first.create()

    expect(useSchemeLibrary()).toBe(first)
    expect(useSchemeLibrary().documents.value.map(document => document.id)).toEqual([created?.id])
  })

  it('creates and persists a new scheme', () => {
    const library = useSchemeLibrary()
    const created = library.create()

    expect(created?.file.scheme.name).toBe('Новая схема')
    expect(loadStudioSchemes().map(document => document.id)).toEqual([created?.id])
  })

  it('duplicates a scheme under a new id with a copy name', () => {
    const original = createStudioScheme('Партер')
    original.file = withObjects('Партер')
    saveStudioSchemes([original])
    const library = useSchemeLibrary()

    const copy = library.duplicate(original.id)

    expect(copy).not.toBeNull()
    expect(copy?.id).not.toBe(original.id)
    expect(copy?.file.scheme).toEqual({ name: 'Партер (копия)', group_name: 'Театры' })
    expect(copy?.file.objects).toEqual(original.file.objects)
    expect(loadStudioSchemes().map(document => document.file.scheme.name)).toEqual(['Партер', 'Партер (копия)'])
  })

  it('keeps the copy name within the identity limit', () => {
    const original = createStudioScheme('я'.repeat(255))
    saveStudioSchemes([original])

    const copy = useSchemeLibrary().duplicate(original.id)

    expect(Array.from(copy?.file.scheme.name ?? '')).toHaveLength(255)
    expect(copy?.file.scheme.name.endsWith(' (копия)')).toBe(true)
  })

  it('removes only the requested scheme', () => {
    const first = createStudioScheme('Партер')
    const second = createStudioScheme('Балкон')
    saveStudioSchemes([first, second])
    const library = useSchemeLibrary()

    expect(library.remove(first.id)).toBe(true)
    expect(library.remove('missing')).toBe(false)
    expect(loadStudioSchemes().map(document => document.id)).toEqual([second.id])
    expect(library.documents.value.map(document => document.id)).toEqual([second.id])
  })

  it('renames with canonical identity and rejects an empty name', () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const library = useSchemeLibrary()

    expect(library.rename(existing.id, '  Большой зал ', '  Театры ')).toBe(true)
    expect(loadStudioSchemes()[0].file.scheme).toEqual({ name: 'Большой зал', group_name: 'Театры' })

    expect(library.rename(existing.id, '   ', null)).toBe(false)
    expect(loadStudioSchemes()[0].file.scheme.name).toBe('Большой зал')
  })

  it('saves editor state into the requested document without legacy capacity', () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const library = useSchemeLibrary()
    const objects: SeatMapObject[] = [{ external_key: 'floor', type: 'dancefloor', label: 'Танцпол', x: 1, y: 2, capacity: 80 }]

    const saved = library.saveEditorState(existing.id, { width: 900, height: 600 }, objects, [], { section_contents: 'always', sector_price_labels: false })

    expect(saved?.file.objects).toEqual([{ external_key: 'floor', type: 'dancefloor', label: 'Танцпол', x: 1, y: 2 }])
    expect(loadStudioSchemes()[0].file.schema_json).toEqual({
      canvas: { width: 900, height: 600 },
      price_groups: [],
      sections: [],
      display: { section_contents: 'always', sector_price_labels: false },
    })
  })

  it('imports a valid JSON file and reports an invalid one', async () => {
    const library = useSchemeLibrary()

    const imported = await library.importFile(jsonFile(withObjects('Импорт')))
    expect(imported?.file.scheme.name).toBe('Импорт')
    expect(library.importError.value).toBe('')

    const rejected = await library.importFile(jsonFile({ format: 'other' }))
    expect(rejected).toBeNull()
    expect(library.importError.value).toBe('Поддерживается JSON-схема FPass версии 2.')
    expect(loadStudioSchemes()).toHaveLength(1)
  })

  it('exports the stored JSON of a document', async () => {
    const existing = createStudioScheme('Главный зал')
    saveStudioSchemes([existing])
    let exported: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob) exported = value
      return 'blob:export'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    expect(useSchemeLibrary().exportDocument(existing.id)).toBe(true)

    expect(click).toHaveBeenCalledTimes(1)
    expect(JSON.parse(await exported!.text())).toEqual(existing.file)
  })

  it('loads the example schemes', () => {
    const library = useSchemeLibrary()

    library.loadExamples()

    expect(library.documents.value).toHaveLength(EXAMPLE_SCHEME_NAMES.length)
    expect(new Set(loadStudioSchemes().map(document => document.file.scheme.group_name))).toEqual(new Set(['Примеры']))
  })

  it('reports a persistence error and keeps state when storage rejects writes', () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    vi.stubGlobal('localStorage', new FailingStorage(localStorage, 'write'))
    const library = useSchemeLibrary()

    expect(library.create()).toBeNull()
    expect(library.duplicate(existing.id)).toBeNull()
    expect(library.remove(existing.id)).toBe(false)
    expect(library.persistenceError.value).toBe('Не удалось сохранить схемы в локальном хранилище. Повторите действие.')
    expect(library.documents.value.map(document => document.id)).toEqual([existing.id])
  })

  it('freezes writes after a failed initial read', () => {
    const backing = localStorage
    saveStudioSchemes([createStudioScheme('Партер')], backing)
    const before = backing.getItem(STORAGE_KEY)
    vi.stubGlobal('localStorage', new FailingStorage(backing, 'read'))
    const library = useSchemeLibrary()

    expect(library.persistenceError.value).toBe('Не удалось загрузить схемы из локального хранилища. Перезагрузите страницу, чтобы повторить.')
    expect(library.create()).toBeNull()
    expect(backing.getItem(STORAGE_KEY)).toBe(before)
  })
})
