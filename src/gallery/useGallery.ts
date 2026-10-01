import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type { StoredStudioScheme, StudioSchemeFile } from '../schemes/library'

export const UNGROUPED_LABEL = 'Без группы'

export interface GalleryCard {
  id: string
  name: string
  groupName: string
  seatsLabel: string
  updatedLabel: string
  cacheKey: string
  file: StudioSchemeFile
}

export interface GalleryGroup {
  name: string
  cards: GalleryCard[]
}

const SEAT_FORMS: Record<string, string> = { one: 'место', few: 'места', many: 'мест', other: 'места' }
const pluralRules = new Intl.PluralRules('ru')
const relativeFormat = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function seatCountLabel(count: number): string {
  return `${count} ${SEAT_FORMS[pluralRules.select(count)]}`
}

export function relativeUpdatedLabel(iso: string, now: Date = new Date()): string {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''

  const seconds = Math.max(0, (now.getTime() - time) / 1000)
  if (seconds < MINUTE) return 'только что'
  if (seconds < HOUR) return relativeFormat.format(-Math.floor(seconds / MINUTE), 'minute')
  if (seconds < DAY) return relativeFormat.format(-Math.floor(seconds / HOUR), 'hour')
  if (seconds < WEEK) return relativeFormat.format(-Math.floor(seconds / DAY), 'day')

  return dateFormat.format(time)
}

function seatCount(file: StudioSchemeFile): number {
  return file.objects.reduce((count, object) => (object.type === 'seat' ? count + 1 : count), 0)
}

function toCard(document: StoredStudioScheme, now: Date): GalleryCard {
  const scheme = document.file.scheme

  return {
    id: document.id,
    name: scheme.name,
    groupName: scheme.group_name ?? UNGROUPED_LABEL,
    seatsLabel: seatCountLabel(seatCount(document.file)),
    updatedLabel: relativeUpdatedLabel(document.updatedAt, now),
    cacheKey: `${document.id}:${document.updatedAt}`,
    file: document.file,
  }
}

function compareGroups(left: string, right: string): number {
  if (left === UNGROUPED_LABEL) return 1
  if (right === UNGROUPED_LABEL) return -1

  return left.localeCompare(right, 'ru')
}

export function galleryGroups(documents: readonly StoredStudioScheme[], query: string, now: Date = new Date()): GalleryGroup[] {
  const needle = query.trim().toLocaleLowerCase('ru')
  const groups = new Map<string, StoredStudioScheme[]>()

  for (const document of documents) {
    const scheme = document.file.scheme
    if (needle !== '' && !scheme.name.toLocaleLowerCase('ru').includes(needle)) continue

    const name = scheme.group_name ?? UNGROUPED_LABEL
    const bucket = groups.get(name)
    if (bucket) bucket.push(document)
    else groups.set(name, [document])
  }

  return [...groups.keys()].sort(compareGroups).map(name => ({
    name,
    cards: [...groups.get(name)!]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(document => toCard(document, now)),
  }))
}

export function useGallery(documents: Ref<StoredStudioScheme[]>): {
  query: Ref<string>
  groups: ComputedRef<GalleryGroup[]>
  isEmpty: ComputedRef<boolean>
} {
  const query = ref('')
  const groups = computed(() => galleryGroups(documents.value, query.value))
  const isEmpty = computed(() => documents.value.length === 0)

  return { query, groups, isEmpty }
}
