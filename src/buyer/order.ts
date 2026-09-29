import type { SeatMapAdmissionArea, SeatMapAdmissionSelection, SeatMapAdmissionSummaryRow } from '@fpass/seat-map/booking'
import { createSeatMapObjectIndex } from '@fpass/seat-map/runtime'
import { sectorDisplayNames, type SeatMapObject, type SeatMapObjectState } from '@fpass/seat-map/schema'

import { statePriceAmount } from './simulation'

export interface BuyerOrderLine {
  key: string
  label: string
  amount: number
  quantity: number
  removable: boolean
}

const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatRubles(amount: number): string {
  return rubles.format(amount / 100)
}

function sectorNamesByMemberKey(objects: SeatMapObject[]): Map<string, string> {
  const { objectByKey, sellableUnitsByTerritoryKey } = createSeatMapObjectIndex(objects)
  const sectorNames = sectorDisplayNames(objects)
  const names = new Map<string, string>()

  for (const [territoryKey, members] of sellableUnitsByTerritoryKey) {
    if (objectByKey.get(territoryKey)?.type !== 'zone') {
      continue
    }

    const name = sectorNames.get(territoryKey) ?? territoryKey
    for (const member of members) {
      if (!names.has(member.external_key)) {
        names.set(member.external_key, name)
      }
    }
  }

  return names
}

function seatLabel(object: SeatMapObject, sectorName: string | undefined): string {
  const parts = [
    sectorName,
    object.row ? `Ряд ${object.row}` : null,
    object.number ? `Место ${object.number}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(' · ') : object.label?.trim() || object.external_key
}

export function admissionLineKey(selection: Pick<SeatMapAdmissionSelection, 'area_id' | 'offer_variant_id'>): string {
  return `${selection.area_id}:${selection.offer_variant_id}`
}

export function buyerOrderLines(
  objects: SeatMapObject[],
  states: SeatMapObjectState[],
  selectedKeys: string[],
  admissionRows: SeatMapAdmissionSummaryRow[] = [],
): BuyerOrderLine[] {
  const objectByKey = new Map(objects.map(object => [object.external_key, object]))
  const stateByKey = new Map(states.map(state => [state.external_key, state]))
  const sectorNames = sectorNamesByMemberKey(objects)

  const seatLines = selectedKeys.flatMap((key) => {
    const object = objectByKey.get(key)
    if (!object) {
      return []
    }

    const label = object.type === 'seat'
      ? seatLabel(object, sectorNames.get(key))
      : object.label?.trim() || key

    return [{ key, label, amount: statePriceAmount(stateByKey.get(key)) ?? 0, quantity: 1, removable: false }]
  })
  const admissionLines = admissionRows.map(row => ({
    key: admissionLineKey(row),
    label: row.offer_name,
    amount: row.total_amount,
    quantity: row.quantity,
    removable: true,
  }))

  return [...seatLines, ...admissionLines]
}

export function limitAdmissionSelections(
  selections: SeatMapAdmissionSelection[],
  limit: number,
): SeatMapAdmissionSelection[] {
  let left = Math.max(0, limit)

  return selections.flatMap((selection) => {
    const quantity = Math.min(selection.quantity, left)
    left -= quantity

    return quantity > 0 ? [{ ...selection, quantity }] : []
  })
}

export function admissionAreasWithinLimit(
  areas: SeatMapAdmissionArea[],
  selections: SeatMapAdmissionSelection[],
  limit: number,
): SeatMapAdmissionArea[] {
  return areas.map((area) => {
    const otherAreas = selections
      .filter(selection => selection.area_id !== area.id)
      .reduce((sum, selection) => sum + selection.quantity, 0)
    const areaLimit = limit - otherAreas

    return {
      ...area,
      offers: area.offers.map(offer => ({
        ...offer,
        max_quantity_per_order: Math.max(
          offer.min_quantity_per_order,
          Math.min(offer.max_quantity_per_order ?? areaLimit, areaLimit),
        ),
      })),
    }
  })
}
