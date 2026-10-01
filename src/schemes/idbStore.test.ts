import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { openSchemeDb } from './idbStore'
import { createStudioScheme, type StoredStudioScheme } from './library'

function stored(name: string, updatedAt: string): StoredStudioScheme {
  return { ...createStudioScheme(name), updatedAt }
}

async function rawRecords(factory: IDBFactory): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('fpass-scheme-studio')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return new Promise((resolve, reject) => {
    const request = db.transaction('documents').objectStore('documents').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

describe('openSchemeDb', () => {
  it('starts empty', async () => {
    const db = await openSchemeDb(new IDBFactory())

    expect(await db.getAll()).toEqual([])
  })

  it('puts, replaces and removes documents by id', async () => {
    const factory = new IDBFactory()
    const db = await openSchemeDb(factory)
    const first = stored('Партер', '2026-10-01T10:00:00.000Z')
    const second = stored('Балкон', '2026-10-01T11:00:00.000Z')

    await db.putAll([first, second])
    await db.put({ ...first, file: { ...first.file, scheme: { name: 'Новый партер', group_name: null } } })
    await db.remove(second.id)

    expect((await db.getAll()).map(document => document.file.scheme.name)).toEqual(['Новый партер'])
    expect(await rawRecords(factory)).toHaveLength(1)
  })

  it('returns documents ordered by update time and keeps them across connections', async () => {
    const factory = new IDBFactory()
    const later = stored('Позже', '2026-10-01T12:00:00.000Z')
    const earlier = stored('Раньше', '2026-10-01T09:00:00.000Z')
    await (await openSchemeDb(factory)).putAll([later, earlier])

    const reopened = await openSchemeDb(factory)

    expect((await reopened.getAll()).map(document => document.id)).toEqual([earlier.id, later.id])
  })

  it('stores reactive documents as plain data', async () => {
    const db = await openSchemeDb(new IDBFactory())
    const document = stored('Партер', '2026-10-01T10:00:00.000Z')

    await db.put(reactive(document) as StoredStudioScheme)

    expect(await db.getAll()).toEqual([document])
  })

  it('skips malformed records', async () => {
    const factory = new IDBFactory()
    const db = await openSchemeDb(factory)
    const valid = stored('Партер', '2026-10-01T10:00:00.000Z')
    await db.putAll([valid, { ...valid, id: 'broken', file: { ...valid.file, objects: [null] } } as unknown as StoredStudioScheme])

    expect(await db.getAll()).toEqual([valid])
  })

  it('rejects when the database cannot be opened', async () => {
    const factory = { open: () => { throw new DOMException('denied', 'SecurityError') } } as unknown as IDBFactory

    await expect(openSchemeDb(factory)).rejects.toThrow('denied')
  })
})
