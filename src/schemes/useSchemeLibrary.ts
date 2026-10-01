import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'
import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'

import { buildExampleSchemes, EXAMPLE_SCHEME_NAMES } from '../examples/exampleSchemes'
import {
  canonicalizeStudioSchemeIdentity,
  createStudioScheme,
  loadStudioSchemes,
  parseStudioSchemeFile,
  saveStudioSchemes,
  type StoredStudioScheme,
  type StudioSchemeFile,
} from './library'

export const LOAD_ERROR = 'Не удалось загрузить схемы из локального хранилища. Перезагрузите страницу, чтобы повторить.'
export const SAVE_ERROR = 'Не удалось сохранить схемы в локальном хранилище. Повторите действие.'
const IMPORT_ERROR = 'Не удалось открыть JSON-файл.'
const COPY_SUFFIX = ' (копия)'
const MAX_NAME_CODE_POINTS = 255

export interface SchemeLibrary {
  documents: ShallowRef<StoredStudioScheme[]>
  persistenceError: Ref<string>
  importError: Ref<string>
  find(id: string): StoredStudioScheme | null
  create(): StoredStudioScheme | null
  importFile(file: File): Promise<StoredStudioScheme | null>
  duplicate(id: string): StoredStudioScheme | null
  remove(id: string): boolean
  rename(id: string, name: string, groupName: string | null): boolean
  saveEditorState(
    id: string,
    canvas: SeatMapCanvasSize,
    objects: SeatMapObject[],
    priceGroups: SeatMapPricingGroupOption[],
    display: SeatMapDisplaySettings | null,
  ): StoredStudioScheme | null
  exportDocument(id: string): boolean
  loadExamples(): void
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

function createSchemeLibrary(): SchemeLibrary {
  const persistenceError = ref('')
  const importError = ref('')
  let storageAuthoritative = true
  const documents = shallowRef<StoredStudioScheme[]>(loadDocuments())

  function loadDocuments(): StoredStudioScheme[] {
    try {
      return loadStudioSchemes()
    } catch {
      storageAuthoritative = false
      persistenceError.value = LOAD_ERROR
      return []
    }
  }

  function persist(nextDocuments: StoredStudioScheme[]): boolean {
    if (!storageAuthoritative) {
      persistenceError.value = LOAD_ERROR
      return false
    }

    try {
      saveStudioSchemes(nextDocuments)
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

  function append(files: (StudioSchemeFile | undefined)[]): StoredStudioScheme[] | null {
    const occupied = new Set(documents.value.map(document => document.id))
    const added = files.map(file => uniqueDocument(file, occupied))

    return persist([...documents.value, ...added]) ? added : null
  }

  function update(id: string, change: (file: StudioSchemeFile) => StudioSchemeFile): StoredStudioScheme | null {
    const current = find(id)
    if (current === null) {
      return null
    }

    const updated = { ...current, updatedAt: new Date().toISOString(), file: change(current.file) }
    const nextDocuments = documents.value.map(document => (document.id === id ? updated : document))

    return persist(nextDocuments) ? updated : null
  }

  function create(): StoredStudioScheme | null {
    return append([undefined])?.[0] ?? null
  }

  async function importFile(file: File): Promise<StoredStudioScheme | null> {
    let parsed: StudioSchemeFile
    try {
      parsed = parseStudioSchemeFile(await readJson(file))
    } catch (error) {
      importError.value = error instanceof Error ? error.message : IMPORT_ERROR
      return null
    }

    const added = append([parsed])?.[0] ?? null
    if (added !== null) {
      importError.value = ''
    }

    return added
  }

  function duplicate(id: string): StoredStudioScheme | null {
    const source = find(id)
    if (source === null) {
      return null
    }

    const file = structuredClone(source.file)

    return append([{ ...file, scheme: { ...file.scheme, name: copyName(file.scheme.name) } }])?.[0] ?? null
  }

  function remove(id: string): boolean {
    if (find(id) === null) {
      return false
    }

    return persist(documents.value.filter(document => document.id !== id))
  }

  function rename(id: string, name: string, groupName: string | null): boolean {
    let scheme: StudioSchemeFile['scheme']
    try {
      scheme = canonicalizeStudioSchemeIdentity(name, groupName)
    } catch {
      return false
    }

    return update(id, file => ({ ...file, scheme })) !== null
  }

  function saveEditorState(
    id: string,
    canvas: SeatMapCanvasSize,
    objects: SeatMapObject[],
    priceGroups: SeatMapPricingGroupOption[],
    display: SeatMapDisplaySettings | null,
  ): StoredStudioScheme | null {
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

  function loadExamples(): void {
    const examples = buildExampleSchemes()
    append(EXAMPLE_SCHEME_NAMES.map(name => examples[name]))
  }

  return {
    documents,
    persistenceError,
    importError,
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
  instance ??= createSchemeLibrary()
  return instance
}

export function resetSchemeLibrary(): void {
  instance = null
}
