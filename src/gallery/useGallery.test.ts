import { describe, expect, it } from 'vitest'

import { createStudioScheme, type StoredStudioScheme } from '../schemes/library'
import { galleryGroups, relativeUpdatedLabel, seatCountLabel } from './useGallery'

const NOW = new Date('2026-10-01T12:00:00.000Z')

function stored(name: string, groupName: string | null, updatedAt: string, seats = 0): StoredStudioScheme {
  const document = createStudioScheme(name)

  return {
    ...document,
    updatedAt,
    file: {
      ...document.file,
      scheme: { name, group_name: groupName },
      objects: Array.from({ length: seats }, (_, index) => ({
        external_key: `seat-${index}`,
        type: 'seat',
        label: String(index),
        x: index,
        y: 0,
      })),
    },
  }
}

describe('galleryGroups', () => {
  const documents = [
    stored('Партер', 'Театры', '2026-10-01T10:00:00.000Z', 3),
    stored('Черновик', null, '2026-09-30T10:00:00.000Z'),
    stored('Клуб', 'Клубы', '2026-09-29T10:00:00.000Z', 1),
    stored('Балкон', 'Театры', '2026-10-01T11:00:00.000Z'),
  ]

  it('groups by scheme group with «Без группы» last and newest first inside a group', () => {
    const groups = galleryGroups(documents, '', NOW)

    expect(groups.map(group => group.name)).toEqual(['Клубы', 'Театры', 'Без группы'])
    expect(groups[1].cards.map(card => card.name)).toEqual(['Балкон', 'Партер'])
  })

  it('filters by name case-insensitively and drops empty groups', () => {
    const groups = galleryGroups(documents, '  пАр ', NOW)

    expect(groups.map(group => group.name)).toEqual(['Театры'])
    expect(groups[0].cards.map(card => card.name)).toEqual(['Партер'])
  })

  it('describes each card', () => {
    const [card] = galleryGroups(documents, 'Партер', NOW)[0].cards

    expect(card).toMatchObject({
      id: documents[0].id,
      groupName: 'Театры',
      seatsLabel: '3 места',
      updatedLabel: '2 часа назад',
      cacheKey: `${documents[0].id}:2026-10-01T10:00:00.000Z`,
    })
  })
})

describe('seatCountLabel', () => {
  it('uses Russian plural forms', () => {
    expect([0, 1, 2, 5, 21, 8300].map(seatCountLabel)).toEqual(['0 мест', '1 место', '2 места', '5 мест', '21 место', '8300 мест'])
  })
})

describe('relativeUpdatedLabel', () => {
  it('describes recent and older changes', () => {
    expect(relativeUpdatedLabel('2026-10-01T11:59:30.000Z', NOW)).toBe('только что')
    expect(relativeUpdatedLabel('2026-10-01T11:55:00.000Z', NOW)).toBe('5 минут назад')
    expect(relativeUpdatedLabel('2026-09-28T12:00:00.000Z', NOW)).toBe('3 дня назад')
    expect(relativeUpdatedLabel('2026-08-01T12:00:00.000Z', NOW)).toBe('1 авг. 2026 г.')
    expect(relativeUpdatedLabel('not a date', NOW)).toBe('')
  })
})
