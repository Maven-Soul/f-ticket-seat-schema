import type { SeatMapBookingSectorSummary } from '@fpass/seat-map/booking'
import { createSeatMapObjectIndex } from '@fpass/seat-map/runtime'
import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a(value: string): number {
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }

  return hash
}

export function statePriceAmount(state: SeatMapObjectState | undefined): number | null {
  return state?.current_price_amount ?? state?.price_amount ?? state?.base_price_amount ?? null
}

export function applySimulatedSales(
  states: SeatMapObjectState[],
  percent: number,
): SeatMapObjectState[] {
  return states.map((state) => {
    if (!state.purchasable || fnv1a(state.external_key) % 100 >= percent) {
      return state
    }

    return { ...state, purchasable: false, status: 'sold' }
  })
}

export function simulatedSectorSummaries(
  objects: SeatMapObject[],
  states: SeatMapObjectState[],
): SeatMapBookingSectorSummary[] {
  const stateByKey = new Map(states.map(state => [state.external_key, state]))
  const { objectByKey, sellableUnitsByTerritoryKey } = createSeatMapObjectIndex(objects)
  const summaries: SeatMapBookingSectorSummary[] = []

  for (const [sectorKey, members] of sellableUnitsByTerritoryKey) {
    if (objectByKey.get(sectorKey)?.type !== 'zone' || members.length === 0) {
      continue
    }

    const prices = members
      .map(member => stateByKey.get(member.external_key))
      .filter(state => state?.purchasable === true)
      .map(state => statePriceAmount(state))
    const amounts = prices.filter((amount): amount is number => amount !== null)

    summaries.push({
      sector_key: sectorKey,
      price_min_amount: amounts.length > 0 ? Math.min(...amounts) : null,
      price_max_amount: amounts.length > 0 ? Math.max(...amounts) : null,
      remaining: prices.length,
      remaining_display_mode: 'exact',
    })
  }

  return summaries
}
