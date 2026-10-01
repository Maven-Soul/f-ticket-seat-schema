import { openSchemeDb, type SchemeDb } from './idbStore'
import { clearStudioSchemes, loadStudioSchemes, saveStudioSchemes, type StoredStudioScheme } from './library'

export type SchemeChange =
  | { put: StoredStudioScheme[] }
  | { remove: string }

export interface SchemeStore {
  readonly kind: 'indexeddb' | 'localStorage'
  load(): Promise<StoredStudioScheme[]>
  commit(next: StoredStudioScheme[], change: SchemeChange): Promise<void>
}

function localStorageStore(): SchemeStore {
  return {
    kind: 'localStorage',
    load: async () => loadStudioSchemes(),
    commit: async next => saveStudioSchemes(next),
  }
}

function clearLegacy(): void {
  try {
    clearStudioSchemes()
  } catch {
    return
  }
}

async function migrateLegacy(db: SchemeDb): Promise<StoredStudioScheme[]> {
  const legacy = loadStudioSchemes()
  if (legacy.length > 0) {
    await db.putAll(legacy)
    clearLegacy()
  }

  return legacy
}

function indexedDbStore(factory: IDBFactory): SchemeStore {
  let db: Promise<SchemeDb> | null = null
  const connection = (): Promise<SchemeDb> => (db ??= openSchemeDb(factory))

  return {
    kind: 'indexeddb',
    async load() {
      const opened = await connection()
      const documents = await opened.getAll()

      return documents.length > 0 ? documents : migrateLegacy(opened)
    },
    async commit(_next, change) {
      const opened = await connection()
      await ('remove' in change ? opened.remove(change.remove) : opened.putAll(change.put))
    },
  }
}

export function createSchemeStore(): SchemeStore {
  const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB

  return factory === undefined ? localStorageStore() : indexedDbStore(factory)
}
