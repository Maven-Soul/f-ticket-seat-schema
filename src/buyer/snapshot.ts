import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'

export interface BuyerPreviewSnapshot {
  name: string
  canvas: SeatMapCanvasSize
  objects: SeatMapObject[]
  priceGroups: SeatMapPricingGroupOption[]
  display: SeatMapDisplaySettings | null
  createdAt: string
}

const SNAPSHOT_KEY_PREFIX = 'fpass-scheme-studio:buyer-preview:'

export function buyerPreviewStorageKey(documentId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}${documentId}`
}

function removeOtherSnapshots(keep: string): void {
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
  keys
    .filter((key): key is string => key !== null && key.startsWith(SNAPSHOT_KEY_PREFIX) && key !== keep)
    .forEach(key => localStorage.removeItem(key))
}

export function saveBuyerPreviewSnapshot(documentId: string, snapshot: BuyerPreviewSnapshot): void {
  const key = buyerPreviewStorageKey(documentId)
  removeOtherSnapshots(key)
  localStorage.setItem(key, JSON.stringify(snapshot))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSnapshot(value: unknown): value is BuyerPreviewSnapshot {
  return isRecord(value)
    && typeof value.name === 'string'
    && isRecord(value.canvas)
    && Array.isArray(value.objects)
    && Array.isArray(value.priceGroups)
    && (value.display === null || isRecord(value.display))
}

export function loadBuyerPreviewSnapshot(documentId: string): BuyerPreviewSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(buyerPreviewStorageKey(documentId)) ?? 'null')

    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}
