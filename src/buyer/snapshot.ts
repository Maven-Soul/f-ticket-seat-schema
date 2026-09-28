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

export function buyerPreviewStorageKey(documentId: string): string {
  return `fpass-scheme-studio:buyer-preview:${documentId}`
}

export function saveBuyerPreviewSnapshot(documentId: string, snapshot: BuyerPreviewSnapshot): void {
  localStorage.setItem(buyerPreviewStorageKey(documentId), JSON.stringify(snapshot))
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
