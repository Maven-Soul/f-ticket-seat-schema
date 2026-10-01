import { beforeEach, describe, expect, it } from 'vitest'

import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import {
  dancefloorCategoryKeys,
  loadSimulationSettings,
  saveSimulationSettings,
  simulationSettingsKey,
} from './simulationSettings'

const priceGroups: SeatMapPricingGroupOption[] = [
  { key: 'early', name: 'Early bird', color: '#22c55e', price_amount: 150000 },
  { key: 'floor', name: 'Стандарт', color: '#f97316', price_amount: 250000 },
]

function dancefloor(overrides: Partial<SeatMapObject> = {}): SeatMapObject {
  return { external_key: 'floor', type: 'dancefloor', label: 'Танцпол', capacity: 100, price_group_key: 'floor', x: 0, y: 0, ...overrides }
}

describe('simulationSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores settings per document under the studio key', () => {
    expect(simulationSettingsKey('doc-1')).toBe('fpass-scheme-studio:buyer-simulation:doc-1')
  })

  it('defaults to no dancefloor categories', () => {
    expect(loadSimulationSettings('doc-1')).toEqual({ dancefloorCategories: {} })
  })

  it('loads what was saved', () => {
    saveSimulationSettings('doc-1', { dancefloorCategories: { floor: ['early', 'floor'] } })

    expect(loadSimulationSettings('doc-1')).toEqual({ dancefloorCategories: { floor: ['early', 'floor'] } })
    expect(loadSimulationSettings('doc-2')).toEqual({ dancefloorCategories: {} })
  })

  it('falls back to defaults for invalid JSON or an invalid shape', () => {
    localStorage.setItem(simulationSettingsKey('doc-1'), '{broken')
    expect(loadSimulationSettings('doc-1')).toEqual({ dancefloorCategories: {} })

    localStorage.setItem(simulationSettingsKey('doc-1'), JSON.stringify({ dancefloorCategories: { floor: 'early', other: ['a', 1] } }))
    expect(loadSimulationSettings('doc-1')).toEqual({ dancefloorCategories: { other: ['a'] } })
  })

  it('ignores storage errors when saving', () => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    try {
      expect(() => saveSimulationSettings('doc-1', { dancefloorCategories: {} })).not.toThrow()
    } finally {
      Storage.prototype.setItem = setItem
    }
  })
})

describe('dancefloorCategoryKeys', () => {
  it('uses the dancefloor price group by default', () => {
    expect(dancefloorCategoryKeys(dancefloor(), { dancefloorCategories: {} }, priceGroups)).toEqual(['floor'])
    expect(dancefloorCategoryKeys(dancefloor({ price_group_key: null }), { dancefloorCategories: {} }, priceGroups)).toEqual([])
  })

  it('returns stored categories and drops removed price groups', () => {
    const settings = { dancefloorCategories: { floor: ['early', 'removed', 'floor'] } }

    expect(dancefloorCategoryKeys(dancefloor(), settings, priceGroups)).toEqual(['early', 'floor'])
    expect(dancefloorCategoryKeys(dancefloor(), settings)).toEqual(['early', 'removed', 'floor'])
  })

  it('falls back to the own group when every stored category was removed', () => {
    const settings = { dancefloorCategories: { floor: ['removed'] } }

    expect(dancefloorCategoryKeys(dancefloor(), settings, priceGroups)).toEqual(['floor'])
  })
})
