import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'
import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

import {
  buildExampleSchemes,
  buildLargeExampleSchemes,
  EXAMPLE_SCHEME_NAMES,
  LARGE_EXAMPLE_SCHEME_NAMES,
} from '../examples/exampleSchemes'
import {
  canonicalizeStudioSchemeIdentity,
  createStudioScheme,
  parseStudioSchemeFile,
  type StoredStudioScheme,
  type StudioSchemeFile,
} from './library'
import { createSchemeStore, type SchemeChange, type SchemeStore } from './schemeStore'

export const LOAD_ERROR = 'Не удалось загрузить схемы из локального хранилища. Перезагрузите страницу, чтобы повторить.'
export const SAVE_ERROR = 'Не удалось сохранить схемы в локальном хранилище. Повторите действие.'
const IMPORT_ERROR = 'Не удалось открыть JSON-файл.'
const COPY_SUFFIX = ' (копия)'
const MAX_NAME_CODE_POINTS = 255

export interface SchemeLibrary {
  documents: ShallowRef<StoredStudioScheme[]>
  persistenceError: Ref<string>
  importError: Ref<string>
  loading: Ref<boolean>
  ready: Promise<void>
  find(id: string): StoredStudioScheme | null
  create(): Promise<StoredStudioScheme | null>
  importFile(file: File): Promise<StoredStudioScheme | null>
  duplicate(id: string): Promise<StoredStudioScheme | null>
  remove(id: string): Promise<boolean>
  rename(id: string, name: string, groupName: string | null): Promise<boolean>
  saveEditorState(
    id: string,
    canvas: SeatMapCanvasSize,
    objects: SeatMapObject[],
    priceGroups: SeatMapPricingGroupOption[],
    display: SeatMapDisplaySettings | null,
  ): Promise<StoredStudioScheme | null>
  exportDocument(id: string): boolean
  loadExamples(): Promise<void>
}

let instance: SchemeLibrary | null = null

function withoutLegacyCapacity(objects: SeatMapObject[]): SeatMapObject[] {
  return objects.map((object) => {
    const capacityFreeObject = { ...object }
    delete capacityFreeObject.capacity
    return capacityFreeObject
  })
}

function copyName(name: string): string {
  const base = Array.from(name).slice(0, MAX_NAME_CODE_POINTS - COPY_SUFFIX.length).join('')

  return `${base}${COPY_SUFFIX}`
}

function filenameFor(file: StudioSchemeFile): string {
  const slug = file.scheme.name
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'fpass-scheme'}.json`
}

function downloadFile(file: StudioSchemeFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filenameFor(file)
  anchor.click()
  URL.revokeObjectURL(url)
}

async function readJson(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text())
  } catch {
    return null
  }
}

function createSchemeLibrary(store: SchemeStore): SchemeLibrary {
  const persistenceError = ref('')
  const importError = ref('')
  const loading = ref(true)
  const documents = shallowRef<StoredStudioScheme[]>([])
  let storageAuthoritative = false

  async function loadDocuments(): Promise<void> {
    try {
      documents.value = await store.load()
      storageAuthoritative = true
    } catch {
      persistenceError.value = LOAD_ERROR
    } finally {
      loading.value = false
    }
  }

  const ready = loadDocuments()
  let queue: Promise<unknown> = ready

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task)
    queue = run.catch(() => undefined)
    return run
  }

  async function persist(nextDocuments: StoredStudioScheme[], change: SchemeChange): Promise<boolean> {
    if (!storageAuthoritative) {
      persistenceError.value = LOAD_ERROR
      return false
    }

    try {
      await store.commit(nextDocuments, change)
      documents.value = nextDocuments
      persistenceError.value = ''
      return true
    } catch {
      persistenceError.value = SAVE_ERROR
      return false
    }
  }

  function find(id: string): StoredStudioScheme | null {
    return documents.value.find(document => document.id === id) ?? null
  }

  function uniqueDocument(file: StudioSchemeFile | undefined, occupied: Set<string>): StoredStudioScheme {
    let document = createStudioScheme(file?.scheme.name)
    while (occupied.has(document.id)) {
      document = createStudioScheme(file?.scheme.name)
    }
    occupied.add(document.id)

    return file ? { ...document, file } : document
  }

  async function appendNow(files: (StudioSchemeFile | undefined)[]): Promise<StoredStudioScheme[] | null> {
    const occupied = new Set(documents.value.map(document => document.id))
    const added = files.map(file => uniqueDocument(file, occupied))

    return await persist([...documents.value, ...added], { put: added }) ? added : null
  }

  function append(files: (StudioSchemeFile | undefined)[]): Promise<StoredStudioScheme[] | null> {
    return enqueue(() => appendNow(files))
  }

  function update(id: string, change: (file: StudioSchemeFile) => StudioSchemeFile): Promise<StoredStudioScheme | null> {
    return enqueue(async () => {
      const current = find(id)
      if (current === null) {
        return null
      }

      const updated = { ...current, updatedAt: new Date().toISOString(), file: change(current.file) }
      const nextDocuments = documents.value.map(document => (document.id === id ? updated : document))

      return await persist(nextDocuments, { put: [updated] }) ? updated : null
    })
  }

  async function create(): Promise<StoredStudioScheme | null> {
    return (await append([undefined]))?.[0] ?? null
  }

  async function importFile(file: File): Promise<StoredStudioScheme | null> {
    let parsed: StudioSchemeFile
    try {
      parsed = parseStudioSchemeFile(await readJson(file))
    } catch (error) {
      importError.value = error instanceof Error ? error.message : IMPORT_ERROR
      return null
    }

    const added = (await append([parsed]))?.[0] ?? null
    if (added !== null) {
      importError.value = ''
    }

    return added
  }

  function duplicate(id: string): Promise<StoredStudioScheme | null> {
    return enqueue(async () => {
      const source = find(id)
      if (source === null) {
        return null
      }

      const file = structuredClone(source.file)
      const copy = { ...file, scheme: { ...file.scheme, name: copyName(file.scheme.name) } }

      return (await appendNow([copy]))?.[0] ?? null
    })
  }

  function remove(id: string): Promise<boolean> {
    return enqueue(async () => (
      find(id) !== null
      && persist(documents.value.filter(document => document.id !== id), { remove: id })
    ))
  }

  async function rename(id: string, name: string, groupName: string | null): Promise<boolean> {
    let scheme: StudioSchemeFile['scheme']
    try {
      scheme = canonicalizeStudioSchemeIdentity(name, groupName)
    } catch {
      return false
    }

    return await update(id, file => ({ ...file, scheme })) !== null
  }

  function saveEditorState(
    id: string,
    canvas: SeatMapCanvasSize,
    objects: SeatMapObject[],
    priceGroups: SeatMapPricingGroupOption[],
    display: SeatMapDisplaySettings | null,
  ): Promise<StoredStudioScheme | null> {
    return update(id, (file) => {
      const { display: _previousDisplay, ...schema } = file.schema_json

      return {
        ...file,
        schema_json: { ...schema, canvas, price_groups: priceGroups, sections: [], ...(display ? { display } : {}) },
        objects: withoutLegacyCapacity(objects),
      }
    })
  }

  function exportDocument(id: string): boolean {
    const document = find(id)
    if (document === null) {
      return false
    }

    downloadFile(document.file)
    return true
  }

  async function loadExamples(): Promise<void> {
    const examples = buildExampleSchemes()
    const large = store.kind === 'indexeddb' ? buildLargeExampleSchemes() : null
    const largeFiles = large === null ? [] : LARGE_EXAMPLE_SCHEME_NAMES.map(name => large[name])

    await append([...EXAMPLE_SCHEME_NAMES.map(name => examples[name]), ...largeFiles])
  }

  return {
    documents,
    persistenceError,
    importError,
    loading,
    ready,
    find,
    create,
    importFile,
    duplicate,
    remove,
    rename,
    saveEditorState,
    exportDocument,
    loadExamples,
  }
}

export function useSchemeLibrary(): SchemeLibrary {
  instance ??= createSchemeLibrary(createSchemeStore())
  return instance
}

export function resetSchemeLibrary(): void {
  instance = null
}
