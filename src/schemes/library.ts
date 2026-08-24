import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapObject } from '@fpass/seat-map/schema'

export interface StudioSchemeFile {
  format: 'fpass-seat-map'
  version: 2
  scheme: {
    name: string
    group_name: string | null
  }
  schema_json: {
    canvas: SeatMapCanvasSize
    price_groups: SeatMapPricingGroupOption[]
    sections: []
  }
  objects: SeatMapObject[]
}

export interface StoredStudioScheme {
  id: string
  updatedAt: string
  file: StudioSchemeFile
}

const FORMAT_ERROR = 'Поддерживается JSON-схема FPass версии 2.'
const STORAGE_KEY = 'fpass-scheme-studio:documents:v2'
const MAX_IDENTITY_CODE_POINTS = 255

export const STUDIO_SCHEME_IDENTITY_ERROR = 'Название схемы обязательно; название и группа должны содержать не более 255 символов.'

export function canonicalizeStudioSchemeIdentity(
  name: string,
  groupName: string | null,
): StudioSchemeFile['scheme'] {
  const canonicalName = name.trim()
  const canonicalGroupName = groupName?.trim() || null

  if (
    canonicalName === ''
    || Array.from(canonicalName).length > MAX_IDENTITY_CODE_POINTS
    || (canonicalGroupName !== null
      && Array.from(canonicalGroupName).length > MAX_IDENTITY_CODE_POINTS)
  ) {
    throw new Error(STUDIO_SCHEME_IDENTITY_ERROR)
  }

  return {
    name: canonicalName,
    group_name: canonicalGroupName,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value)

  return required.every(key => keys.includes(key))
    && keys.every(key => required.includes(key) || optional.includes(key))
}

function hasValidOptional(
  value: Record<string, unknown>,
  key: string,
  predicate: (field: unknown) => boolean,
): boolean {
  return !Object.hasOwn(value, key) || predicate(value[key])
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return isFiniteNumber(value) || value === null
}

function isPricingGroup(value: unknown): value is SeatMapPricingGroupOption {
  return isRecord(value)
    && hasExactKeys(value, ['key', 'name', 'color', 'price_amount'])
    && typeof value.key === 'string'
    && typeof value.name === 'string'
    && typeof value.color === 'string'
    && isFiniteNumber(value.price_amount)
}

function isSeatMapObject(value: unknown): value is SeatMapObject {
  if (
    !isRecord(value)
    || !hasExactKeys(
      value,
      ['external_key', 'type', 'label', 'x', 'y'],
      [
        'row',
        'number',
        'sector_key',
        'is_accessible',
        'view_limited',
        'parent_external_key',
        'width',
        'height',
        'rotation',
        'z_index',
        'style',
        'color',
        'price',
        'price_group_key',
      ],
    )
    || typeof value.external_key !== 'string'
    || typeof value.type !== 'string'
    || !isNullableString(value.label)
    || !isFiniteNumber(value.x)
    || !isFiniteNumber(value.y)
  ) {
    return false
  }

  return ['row', 'number', 'sector_key', 'parent_external_key', 'color', 'price_group_key']
    .every(key => hasValidOptional(value, key, isNullableString))
    && ['is_accessible', 'view_limited']
      .every(key => hasValidOptional(value, key, field => typeof field === 'boolean'))
    && ['width', 'height', 'rotation', 'price']
      .every(key => hasValidOptional(value, key, isNullableFiniteNumber))
    && hasValidOptional(value, 'z_index', isFiniteNumber)
    && hasValidOptional(value, 'style', field => field === null || isRecord(field))
}

function invalidFormat(): never {
  throw new Error(FORMAT_ERROR)
}

export function parseStudioSchemeFile(value: unknown): StudioSchemeFile {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['format', 'version', 'scheme', 'schema_json', 'objects'])
    || value.format !== 'fpass-seat-map'
    || value.version !== 2
    || !isRecord(value.scheme)
    || !hasExactKeys(value.scheme, ['name', 'group_name'])
    || typeof value.scheme.name !== 'string'
    || (typeof value.scheme.group_name !== 'string' && value.scheme.group_name !== null)
    || !isRecord(value.schema_json)
    || !hasExactKeys(value.schema_json, ['canvas', 'price_groups', 'sections'])
    || !isRecord(value.schema_json.canvas)
    || !hasExactKeys(value.schema_json.canvas, ['width', 'height'], ['background'])
  ) {
    return invalidFormat()
  }

  const canvas = value.schema_json.canvas
  const hasBackground = Object.hasOwn(canvas, 'background')
  const background = canvas.background
  const priceGroups = value.schema_json.price_groups
  const sections = value.schema_json.sections
  const objects = value.objects
  let scheme: StudioSchemeFile['scheme']

  try {
    scheme = canonicalizeStudioSchemeIdentity(value.scheme.name, value.scheme.group_name)
  } catch {
    return invalidFormat()
  }

  if (
    !isFiniteNumber(canvas.width)
    || canvas.width <= 0
    || !isFiniteNumber(canvas.height)
    || canvas.height <= 0
    || (hasBackground && typeof background !== 'string' && background !== null)
    || !Array.isArray(priceGroups)
    || !priceGroups.every(isPricingGroup)
    || !Array.isArray(sections)
    || sections.length !== 0
    || !Array.isArray(objects)
    || !objects.every(isSeatMapObject)
  ) {
    return invalidFormat()
  }

  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme,
    schema_json: {
      canvas: {
        width: canvas.width,
        height: canvas.height,
        ...(hasBackground ? { background: background as string | null } : {}),
      },
      price_groups: priceGroups,
      sections: [],
    },
    objects,
  }
}

export function createStudioScheme(name = 'Новая схема'): StoredStudioScheme {
  const scheme = canonicalizeStudioSchemeIdentity(name.trim() || 'Новая схема', null)

  return {
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    file: {
      format: 'fpass-seat-map',
      version: 2,
      scheme,
      schema_json: {
        canvas: {
          width: 1200,
          height: 800,
          background: '#ffffff',
        },
        price_groups: [],
        sections: [],
      },
      objects: [],
    },
  }
}

export function loadStudioSchemes(storage: Storage = localStorage): StoredStudioScheme[] {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const values: unknown = JSON.parse(raw)
    if (!Array.isArray(values)) {
      return []
    }

    const documents: StoredStudioScheme[] = []

    for (const value of values) {
      try {
        if (
          !isRecord(value)
          || !hasExactKeys(value, ['id', 'updatedAt', 'file'])
          || typeof value.id !== 'string'
          || typeof value.updatedAt !== 'string'
        ) {
          continue
        }

        documents.push({
          id: value.id,
          updatedAt: value.updatedAt,
          file: parseStudioSchemeFile(value.file),
        })
      } catch {
        continue
      }
    }

    return documents
  } catch {
    return []
  }
}

export function saveStudioSchemes(
  documents: readonly StoredStudioScheme[],
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(documents))
}
