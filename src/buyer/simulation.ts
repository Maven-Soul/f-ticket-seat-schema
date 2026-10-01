import type { SeatMapAdmissionArea, SeatMapBookingSectorSummary } from '@fpass/seat-map/booking'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import { createSeatMapObjectIndex } from '@fpass/seat-map/runtime'
import type { SeatMapObject, SeatMapObjectState } from '@fpass/seat-map/schema'

import { dancefloorCategoryKeys, type BuyerSimulationSettings } from './simulationSettings'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const ADMISSION_MAX_PER_ORDER = 10

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

function admissionAwareRemaining(
  members: SeatMapObject[],
  purchasableCount: number,
  areaByKey: ReadonlyMap<string, SeatMapAdmissionArea>,
): number | null {
  const points = members.filter(member => member.type === 'dancefloor')
  if (points.length === 0) {
    return purchasableCount
  }

  const areaRemaining = points.map(point => areaByKey.get(point.external_key)?.remaining)
  if (!areaRemaining.every((remaining): remaining is number => typeof remaining === 'number')) {
    return null
  }

  return purchasableCount + areaRemaining.reduce((total, remaining) => total + remaining, 0)
}

export function simulatedSectorSummaries(
  objects: SeatMapObject[],
  states: SeatMapObjectState[],
  admissionAreas: SeatMapAdmissionArea[] = [],
): SeatMapBookingSectorSummary[] {
  const stateByKey = new Map(states.map(state => [state.external_key, state]))
  const areaByKey = new Map(admissionAreas.map(area => [area.scheme_object_external_key, area]))
  const { objectByKey, sellableUnitsByTerritoryKey } = createSeatMapObjectIndex(objects)
  const summaries: SeatMapBookingSectorSummary[] = []

  for (const [sectorKey, members] of sellableUnitsByTerritoryKey) {
    if (objectByKey.get(sectorKey)?.type !== 'zone' || members.length === 0) {
      continue
    }

    const purchasableSeatCount = members
      .filter(member => member.type !== 'dancefloor' && stateByKey.get(member.external_key)?.purchasable === true)
      .length
    const prices = members
      .map(member => stateByKey.get(member.external_key))
      .filter(state => state?.purchasable === true)
      .map(state => statePriceAmount(state))
    const amounts = prices.filter((amount): amount is number => amount !== null)

    summaries.push({
      sector_key: sectorKey,
      price_min_amount: amounts.length > 0 ? Math.min(...amounts) : null,
      price_max_amount: amounts.length > 0 ? Math.max(...amounts) : null,
      remaining: admissionAwareRemaining(members, purchasableSeatCount, areaByKey),
      remaining_display_mode: 'exact',
    })
  }

  return summaries
}

export function simulatedAdmissionAreas(
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  soldPercent: number,
  settings: BuyerSimulationSettings = { dancefloorCategories: {} },
): SeatMapAdmissionArea[] {
  const groupByKey = new Map(priceGroups.map(group => [group.key, group]))

  return objects.flatMap<SeatMapAdmissionArea>((object) => {
    if (object.type !== 'dancefloor') {
      return []
    }

    const groups = dancefloorCategoryKeys(object, settings)
      .map(groupKey => groupByKey.get(groupKey))
      .filter((group): group is SeatMapPricingGroupOption => group !== undefined)
    if (groups.length === 0) {
      return []
    }

    const key = object.external_key
    const label = object.label?.trim() || 'Танцпол'
    const capacity = typeof object.capacity === 'number' ? Math.max(0, Math.floor(object.capacity)) : null
    const remaining = capacity === null ? null : capacity - Math.round(capacity * soldPercent / 100)
    const available = remaining === null ? soldPercent < 100 : remaining > 0

    return [{
      id: `admission-area:${key}`,
      external_key: key,
      scheme_object_external_key: key,
      remaining,
      remaining_display_mode: 'exact',
      offers: groups.map(group => ({
        id: `admission-offer:${key}:${group.key}`,
        external_key: `${key}:${group.key}`,
        name: `${label} · ${group.name}`,
        description: null,
        price: { amount: group.price_amount, currency: 'RUB', color: group.color, group_key: group.key },
        remaining,
        min_quantity_per_order: 1,
        max_quantity_per_order: ADMISSION_MAX_PER_ORDER,
        composition: [],
        terms: [],
        purchasable: available && group.price_amount > 0,
      })),
    }]
  })
}

export function withAdmissionAreaStates(
  states: SeatMapObjectState[],
  areas: SeatMapAdmissionArea[],
): SeatMapObjectState[] {
  const purchasableByKey = new Map(areas.map(area => [
    area.scheme_object_external_key,
    area.offers.some(offer => offer.purchasable),
  ]))

  return states.map((state) => {
    const purchasable = purchasableByKey.get(state.external_key)
    if (purchasable === undefined) {
      return state
    }

    return { ...state, purchasable, status: purchasable ? 'available' : 'sold' }
  })
}
