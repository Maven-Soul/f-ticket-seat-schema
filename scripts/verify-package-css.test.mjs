import { describe, expect, it } from 'vitest'
import { hasStudioLayoutUtility } from './package-css-contract.mjs'

const studioLayoutDeclaration = 'grid-template-columns:190px minmax(380px,1fr) 280px'

describe('package CSS ownership verifier', () => {
  it('requires the Studio layout declaration on its escaped utility selector', () => {
    const expectedUtility = `.grid-cols-\\[190px_minmax\\(380px\\,1fr\\)_280px\\]{${studioLayoutDeclaration}}`
    const wrongSelector = `.wrong-selector{${studioLayoutDeclaration}}`

    expect(hasStudioLayoutUtility(expectedUtility)).toBe(true)
    expect(hasStudioLayoutUtility(wrongSelector)).toBe(false)
  })
})
