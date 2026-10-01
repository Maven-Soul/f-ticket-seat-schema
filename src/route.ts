export type StudioRoute =
  | { view: 'gallery' }
  | { view: 'scheme', id: string }
  | { view: 'buyer', id: string }
  | { view: 'buyer-frame', id: string, sold: number }

const ID_ROUTE = /^#\/(scheme|buyer|buyer-frame)\/([^/?]+)(?:\?(.*))?$/

export const GALLERY_HASH = '#/'

function soldPercent(query: string | undefined): number {
  const value = Number.parseInt(new URLSearchParams(query ?? '').get('sold') ?? '', 10)

  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

function decodeId(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function parseStudioRoute(hash: string): StudioRoute {
  const match = ID_ROUTE.exec(hash)
  const id = match ? decodeId(match[2]) : null
  if (!match || id === null) {
    return { view: 'gallery' }
  }

  if (match[1] === 'scheme') {
    return { view: 'scheme', id }
  }

  return match[1] === 'buyer'
    ? { view: 'buyer', id }
    : { view: 'buyer-frame', id, sold: soldPercent(match[3]) }
}

export function studioUrl(hash: string): string {
  return `${window.location.href.split('#')[0]}${hash}`
}

export function schemeHash(id: string): string {
  return `#/scheme/${encodeURIComponent(id)}`
}

export function buyerPageHash(id: string): string {
  return `#/buyer/${encodeURIComponent(id)}`
}

export function buyerFrameHash(id: string, sold: number): string {
  return `#/buyer-frame/${encodeURIComponent(id)}?sold=${sold}`
}
