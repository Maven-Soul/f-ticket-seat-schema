import { describe, expect, it } from 'vitest'

import { parseStudioRoute } from './route'

describe('parseStudioRoute', () => {
  it('routes buyer simulation and buyer frame hashes', () => {
    expect(parseStudioRoute('#/buyer/doc-1')).toEqual({ view: 'buyer', id: 'doc-1' })
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=30')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 30 })
    expect(parseStudioRoute('#/buyer-frame/doc-1')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 0 })
  })

  it('clamps the sold percentage and falls back to the editor for anything else', () => {
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=250')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 100 })
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=abc')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 0 })
    expect(parseStudioRoute('')).toEqual({ view: 'editor' })
    expect(parseStudioRoute('#/buyer/')).toEqual({ view: 'editor' })
    expect(parseStudioRoute('#/other')).toEqual({ view: 'editor' })
  })
})
