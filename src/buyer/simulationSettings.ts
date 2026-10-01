import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapObject } from '@fpass/seat-map/schema'

export interface BuyerSimulationSettings {
  dancefloorCategories: Record<string, string[]>
}

export function simulationSettingsKey(documentId: string): string {
  return `fpass-scheme-studio:buyer-simulation:${documentId}`
}

function defaultSettings(): BuyerSimulationSettings {
  return { dancefloorCategories: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCategories(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(Object.entries(value).flatMap(([key, keys]) => (
    Array.isArray(keys) ? [[key, keys.filter((candidate): candidate is string => typeof candidate === 'string')]] : []
  )))
}

export function loadSimulationSettings(documentId: string): BuyerSimulationSettings {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(simulationSettingsKey(documentId)) ?? 'null')

    return isRecord(parsed) ? { dancefloorCategories: parseCategories(parsed.dancefloorCategories) } : defaultSettings()
  } catch {
    return defaultSettings()
  }
}

export function saveSimulationSettings(documentId: string, settings: BuyerSimulationSettings): void {
  try {
    localStorage.setItem(simulationSettingsKey(documentId), JSON.stringify(settings))
  } catch {
    return
  }
}

export function dancefloorCategoryKeys(
  object: SeatMapObject,
  settings: BuyerSimulationSettings,
  priceGroups?: SeatMapPricingGroupOption[],
): string[] {
  const known = priceGroups ? new Set(priceGroups.map(group => group.key)) : null
  const stored = (settings.dancefloorCategories[object.external_key] ?? []).filter(key => known === null || known.has(key))
  if (stored.length > 0) {
    return stored
  }

  return object.price_group_key ? [object.price_group_key] : []
}
