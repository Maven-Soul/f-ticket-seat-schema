import { generateRows } from '@fpass/seat-map/editor'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'
import {
  AUTO_DISPLAY,
  block,
  dancefloorArea,
  keyFactory,
  type NextKey,
  type Point,
  type PriceGroup,
  primitive,
  rectPoints,
  rectTable,
  roundTable,
  sold,
  studioFile,
  zone,
} from './helpers'

function roundTables(next: NextKey, sectorKey: string, seats: number, radius: number, centers: Point[], firstNumber: number): SeatMapObject[] {
  return centers.flatMap((center, index) => roundTable(next, sectorKey, seats, radius, center, String(firstNumber + index)))
}

function grid(columns: number[], rows: number[]): Point[] {
  return rows.flatMap(y => columns.map(x => ({ x, y })))
}

export function roofTerrace(): StudioSchemeFile {
  const next = keyFactory()
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 230000 }
  const lower: PriceGroup = { key: 'lower', name: 'Нижняя терраса', color: '#2563eb', price_amount: 440000 }
  const bar: PriceGroup = { key: 'bar', name: 'Барная стойка', color: '#f59e0b', price_amount: 380000 }
  const vip: PriceGroup = { key: 'vip', name: 'VIP-стол', color: '#e11d48', price_amount: 950000 }
  const vipKey = next('zone')
  const barKey = next('zone')
  const lowerKey = next('zone')
  const objects: SeatMapObject[] = [
    zone(vipKey, 'VIP-балкон', 'Балкон', rectPoints(90, 60, 1120, 310)),
    ...sold(roundTables(next, vipKey, 6, 30, grid([180, 335, 490, 645, 800, 955, 1110], [140, 290]), 1), vip, true),
    zone(barKey, 'Барная стойка', 'Терраса', rectPoints(90, 820, 1120, 140)),
    ...sold(generateRows(
      { sectorKey: barKey, rows: 1, seatsPerRow: 40, seatSpacing: 26, rowSpacing: 0, labelScheme: 'cyrillic', curve: 0 },
      { x: 150, y: 860 },
      next,
    ), bar, false),
    primitive(next, 'bar', 'Бар', 130, 890, 1040, 36),
    zone(lowerKey, 'Нижняя терраса', 'Терраса', rectPoints(760, 420, 450, 360)),
    ...grid([840, 985, 1130], [520, 680]).flatMap((center, index) => sold(rectTable(
      next,
      { sectorKey: lowerKey, seatsTop: 2, seatsBottom: 2, seatsLeft: 0, seatsRight: 0 },
      center,
      String(15 + index),
    ), lower, false)),
    ...dancefloorArea(next, 170, 420, 530, 360, dance),
    block(next('stage'), 'Сцена', 80, 440, 60, 320),
  ]

  return studioFile('Пример: руф-терраса', { width: 1300, height: 1000 }, [dance, lower, bar, vip], AUTO_DISPLAY, objects)
}

export function eventHall(): StudioSchemeFile {
  const next = keyFactory()
  const dance: PriceGroup = { key: 'dance', name: 'Танцпол', color: '#16a34a', price_amount: 210000 }
  const vip: PriceGroup = { key: 'vip', name: 'VIP', color: '#2563eb', price_amount: 620000 }
  const backstage: PriceGroup = { key: 'backstage', name: 'Бэкстейдж, стол', color: '#e11d48', price_amount: 990000 }
  const vipOneKey = next('zone')
  const vipTwoKey = next('zone')
  const objects: SeatMapObject[] = [
    zone(vipOneKey, 'VIP 1', 'VIP', rectPoints(60, 80, 340, 820)),
    ...sold(roundTables(next, vipOneKey, 8, 36, grid([150, 310], [200, 450, 700]), 1), vip, false),
    zone(vipTwoKey, 'VIP 2', 'VIP', rectPoints(900, 80, 340, 820)),
    ...sold(roundTables(next, vipTwoKey, 8, 36, grid([990, 1150], [200, 450, 700]), 7), vip, false),
    ...dancefloorArea(next, 450, 80, 400, 440, dance),
    block(next('stage'), 'Сцена', 450, 550, 400, 70),
  ]
  const backstageKey = next('zone')
  objects.push(
    zone(backstageKey, 'Бэкстейдж', 'Бэкстейдж', rectPoints(450, 660, 400, 240)),
    ...sold(roundTables(next, backstageKey, 6, 30, grid([560, 740], [720, 840]), 13), backstage, true),
    primitive(next, 'bar', 'Бар', 450, 960, 400, 50),
  )

  return studioFile('Пример: ивент-холл', { width: 1300, height: 1100 }, [dance, vip, backstage], AUTO_DISPLAY, objects)
}
