import { beforeEach, describe, expect, it } from 'vitest'

import { buyerPreviewStorageKey, loadBuyerPreviewSnapshot, saveBuyerPreviewSnapshot, type BuyerPreviewSnapshot } from './snapshot'

const snapshot: BuyerPreviewSnapshot = {
  name: 'Партер',
  canvas: { width: 800, height: 600, background: '#fff' },
  objects: [],
  priceGroups: [],
  display: null,
  createdAt: '2026-09-29T10:00:00.000Z',
}

describe('buyer preview snapshot', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a snapshot under the document key', () => {
    saveBuyerPreviewSnapshot('doc-1', snapshot)

    expect(JSON.parse(localStorage.getItem(buyerPreviewStorageKey('doc-1'))!)).toEqual(snapshot)
    expect(loadBuyerPreviewSnapshot('doc-1')).toEqual(snapshot)
  })

  it('keeps only the snapshot of the scheme being previewed', () => {
    localStorage.setItem('fpass-scheme-studio:documents:v2', '[]')
    localStorage.setItem('fpass-scheme-studio:editor-panels', '{}')
    saveBuyerPreviewSnapshot('doc-1', snapshot)
    saveBuyerPreviewSnapshot('doc-2', snapshot)

    saveBuyerPreviewSnapshot('doc-3', { ...snapshot, name: 'Балкон' })

    expect(loadBuyerPreviewSnapshot('doc-1')).toBeNull()
    expect(loadBuyerPreviewSnapshot('doc-2')).toBeNull()
    expect(loadBuyerPreviewSnapshot('doc-3')?.name).toBe('Балкон')
    expect(localStorage.getItem('fpass-scheme-studio:documents:v2')).toBe('[]')
    expect(localStorage.getItem('fpass-scheme-studio:editor-panels')).toBe('{}')
  })

  it('returns null for a missing or malformed snapshot', () => {
    localStorage.setItem(buyerPreviewStorageKey('broken'), '{"name":1}')
    localStorage.setItem(buyerPreviewStorageKey('invalid'), 'not json')

    expect(loadBuyerPreviewSnapshot('missing')).toBeNull()
    expect(loadBuyerPreviewSnapshot('broken')).toBeNull()
    expect(loadBuyerPreviewSnapshot('invalid')).toBeNull()
  })
})
