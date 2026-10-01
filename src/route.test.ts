import { describe, expect, it } from 'vitest'

import { parseStudioRoute, schemeHash } from './route'

describe('parseStudioRoute', () => {
  it('routes buyer simulation and buyer frame hashes', () => {
    expect(parseStudioRoute('#/buyer/doc-1')).toEqual({ view: 'buyer', id: 'doc-1' })
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=30')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 30 })
    expect(parseStudioRoute('#/buyer-frame/doc-1')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 0 })
  })

  it('clamps the sold percentage', () => {
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=250')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 100 })
    expect(parseStudioRoute('#/buyer-frame/doc-1?sold=abc')).toEqual({ view: 'buyer-frame', id: 'doc-1', sold: 0 })
  })

  it('routes the gallery for empty, root and unknown hashes', () => {
    expect(parseStudioRoute('')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#/')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#/buyer/')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#/scheme/')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#/other')).toEqual({ view: 'gallery' })
    expect(parseStudioRoute('#/scheme/%E0%A4%A')).toEqual({ view: 'gallery' })
  })

  it('routes and decodes scheme ids', () => {
    expect(parseStudioRoute('#/scheme/doc-1')).toEqual({ view: 'scheme', id: 'doc-1' })
    expect(parseStudioRoute(schemeHash('зал 1/2'))).toEqual({ view: 'scheme', id: 'зал 1/2' })
    expect(schemeHash('doc-1')).toBe('#/scheme/doc-1')
  })
})
