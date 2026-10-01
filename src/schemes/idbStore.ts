import { parseStoredStudioScheme, type StoredStudioScheme } from './library'

const DB_NAME = 'fpass-scheme-studio'
const DB_VERSION = 1
const STORE = 'documents'

export interface SchemeDb {
  getAll(): Promise<StoredStudioScheme[]>
  put(document: StoredStudioScheme): Promise<void>
  putAll(documents: readonly StoredStudioScheme[]): Promise<void>
  remove(id: string): Promise<void>
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new DOMException('Transaction aborted', 'AbortError'))
  })
}

function plain(document: StoredStudioScheme): StoredStudioScheme {
  return JSON.parse(JSON.stringify(document)) as StoredStudioScheme
}

function byUpdateTime(left: StoredStudioScheme, right: StoredStudioScheme): number {
  return left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id)
}

function schemeDb(db: IDBDatabase): SchemeDb {
  async function write(change: (store: IDBObjectStore) => void): Promise<void> {
    const transaction = db.transaction(STORE, 'readwrite')
    const done = completion(transaction)
    try {
      change(transaction.objectStore(STORE))
    } catch (error) {
      done.catch(() => undefined)
      transaction.abort()
      throw error
    }

    await done
  }

  async function getAll(): Promise<StoredStudioScheme[]> {
    const records = await requestResult(db.transaction(STORE).objectStore(STORE).getAll())

    return records
      .flatMap((record: unknown) => {
        const document = parseStoredStudioScheme(record)
        return document === null ? [] : [document]
      })
      .sort(byUpdateTime)
  }

  return {
    getAll,
    put: document => write(store => store.put(plain(document))),
    putAll: documents => write(store => documents.forEach(document => store.put(plain(document)))),
    remove: id => write(store => store.delete(id)),
  }
}

export function openSchemeDb(factory: IDBFactory = indexedDB): Promise<SchemeDb> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(schemeDb(request.result))
    request.onerror = () => reject(request.error)
  })
}
