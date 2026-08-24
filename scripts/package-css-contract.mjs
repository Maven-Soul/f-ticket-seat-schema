const studioLayoutUtility = /\.grid-cols-\\\[190px_minmax\\\(380px\\,1fr\\\)_280px\\\]\{grid-template-columns:190px minmax\(380px,1fr\) 280px\}/

export function hasStudioLayoutUtility(css) {
  return studioLayoutUtility.test(css)
}
