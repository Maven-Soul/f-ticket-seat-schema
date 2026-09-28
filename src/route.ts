export type StudioRoute =
  | { view: 'editor' }
  | { view: 'buyer', id: string }
  | { view: 'buyer-frame', id: string, sold: number }

const BUYER_ROUTE = /^#\/(buyer|buyer-frame)\/([^/?]+)(?:\?(.*))?$/

function soldPercent(query: string | undefined): number {
  const value = Number.parseInt(new URLSearchParams(query ?? '').get('sold') ?? '', 10)

  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
}

export function parseStudioRoute(hash: string): StudioRoute {
  const match = BUYER_ROUTE.exec(hash)
  if (!match) {
    return { view: 'editor' }
  }

  const id = decodeURIComponent(match[2])

  return match[1] === 'buyer'
    ? { view: 'buyer', id }
    : { view: 'buyer-frame', id, sold: soldPercent(match[3]) }
}

export function studioUrl(hash: string): string {
  return `${window.location.href.split('#')[0]}${hash}`
}

export function buyerPageHash(id: string): string {
  return `#/buyer/${encodeURIComponent(id)}`
}

export function buyerFrameHash(id: string, sold: number): string {
  return `#/buyer-frame/${encodeURIComponent(id)}?sold=${sold}`
}
