import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SCHEME_NAMES, LARGE_EXAMPLE_SCHEME_NAMES } from '../examples/exampleSchemes'
import { openSchemeDb } from './idbStore'
import { createStudioScheme, loadStudioSchemes, saveStudioSchemes } from './library'
import { LOAD_ERROR, resetSchemeLibrary, SAVE_ERROR, useSchemeLibrary } from './useSchemeLibrary'

const STORAGE_KEY = 'fpass-scheme-studio:documents:v2'

let factory: IDBFactory

async function reload() {
  resetSchemeLibrary()
  const library = useSchemeLibrary()
  await library.ready
  return library
}

async function storedIds(): Promise<string[]> {
  return (await (await openSchemeDb(factory)).getAll()).map(document => document.id)
}

describe('useSchemeLibrary on IndexedDB', () => {
  beforeEach(() => {
    localStorage.clear()
    factory = new IDBFactory()
    vi.stubGlobal('indexedDB', factory)
    resetSchemeLibrary()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetSchemeLibrary()
  })

  it('migrates documents from localStorage once and clears the old key', async () => {
    const first = createStudioScheme('Партер')
    const second = createStudioScheme('Балкон')
    saveStudioSchemes([first, second])

    const library = useSchemeLibrary()
    await library.ready

    expect(library.documents.value.map(document => document.id)).toEqual([first.id, second.id])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect((await storedIds()).sort()).toEqual([first.id, second.id].sort())

    saveStudioSchemes([createStudioScheme('Не мигрировать')])
    const reloaded = await reload()

    expect(reloaded.documents.value.map(document => document.id).sort()).toEqual([first.id, second.id].sort())
    expect(loadStudioSchemes()).toHaveLength(1)
  })

  it('writes one document per change instead of the whole library', async () => {
    const library = useSchemeLibrary()
    const first = await library.create()
    const second = await library.create()
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')

    expect(await library.rename(first!.id, 'Партер', null)).toBe(true)

    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0][0]).toMatchObject({ id: first!.id })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    expect(await library.remove(second!.id)).toBe(true)
    expect(await storedIds()).toEqual([first!.id])
    expect((await reload()).find(first!.id)?.file.scheme.name).toBe('Партер')
  })

  it('reports SAVE_ERROR and keeps state when a put fails', async () => {
    const library = useSchemeLibrary()
    const existing = await library.create()
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(await library.duplicate(existing!.id)).toBeNull()
    expect(await library.rename(existing!.id, 'Балкон', null)).toBe(false)

    expect(library.persistenceError.value).toBe(SAVE_ERROR)
    expect(library.documents.value.map(document => document.file.scheme.name)).toEqual(['Новая схема'])
    expect(await storedIds()).toEqual([existing!.id])
  })

  it('blocks writes after a failed initial load and keeps localStorage untouched', async () => {
    saveStudioSchemes([createStudioScheme('Партер')])
    const before = localStorage.getItem(STORAGE_KEY)
    vi.stubGlobal('indexedDB', { open: () => { throw new DOMException('denied', 'SecurityError') } })

    const library = useSchemeLibrary()
    await library.ready

    expect(library.loading.value).toBe(false)
    expect(library.persistenceError.value).toBe(LOAD_ERROR)
    expect(await library.create()).toBeNull()
    expect(library.documents.value).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })

  it('stores all examples including the large ones and keeps them after a reload', async () => {
    const library = useSchemeLibrary()

    await library.loadExamples()

    const total = EXAMPLE_SCHEME_NAMES.length + LARGE_EXAMPLE_SCHEME_NAMES.length
    expect(library.persistenceError.value).toBe('')
    expect(library.documents.value).toHaveLength(total)

    const names = (await reload()).documents.value.map(document => document.file.scheme.name)
    expect(names).toHaveLength(total)
    expect(names.some(name => name.includes('арена'))).toBe(true)
    expect(names.some(name => name.toLocaleLowerCase('ru').includes('стадион'))).toBe(true)
  }, 30_000)
})
