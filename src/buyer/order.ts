import { createSeatMapObjectIndex } from '@fpass/seat-map/runtime'
import { sectorDisplayNames, type SeatMapObject, type SeatMapObjectState } from '@fpass/seat-map/schema'

import { statePriceAmount } from './simulation'

export interface BuyerOrderLine {
  key: string
  label: string
  amount: number
  quantity: number
  adjustable: boolean
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

export function buyerOrderLines(
  objects: SeatMapObject[],
  states: SeatMapObjectState[],
  selectedKeys: string[],
  admissionCounts: Record<string, number> = {},
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

    return [{ key, label, amount: statePriceAmount(stateByKey.get(key)) ?? 0, quantity: 1, adjustable: false }]
  })
  const admissionLines = Object.entries(admissionCounts).flatMap(([key, quantity]) => {
    const object = objectByKey.get(key)
    if (!object || quantity <= 0) {
      return []
    }

    const price = statePriceAmount(stateByKey.get(key)) ?? 0

    return [{ key, label: object.label?.trim() || key, amount: price * quantity, quantity, adjustable: true }]
  })

  return [...seatLines, ...admissionLines]
}
