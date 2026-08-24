import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { hasStudioLayoutUtility } from './package-css-contract.mjs'

const projectRoot = new URL('../', import.meta.url)
const sourceCss = await readFile(new URL('src/style.css', projectRoot), 'utf8')

assert.doesNotMatch(
  sourceCss,
  /@source\s+["'][^"']*fpass-seatmap-package\/src[^"']*["']/,
  'standalone Studio must not scan sibling package sources',
)

const packageCssUrl = import.meta.resolve('@fpass/seat-map/seat-map.css')
const packageCss = await readFile(new URL(packageCssUrl), 'utf8')

assert.ok(
  hasStudioLayoutUtility(packageCss),
  'the public package stylesheet must own the Studio editor column layout',
)

const assetsDirectory = new URL('dist/assets/', projectRoot)
const assetNames = await readdir(assetsDirectory)
const cssAssetNames = assetNames.filter((name) => name.endsWith('.css'))

assert.ok(cssAssetNames.length > 0, 'standalone build must emit CSS')

const builtCss = (await Promise.all(cssAssetNames.map((name) => (
  readFile(new URL(name, assetsDirectory), 'utf8')
)))).join('\n')

assert.ok(
  hasStudioLayoutUtility(builtCss),
  'standalone build must retain the Studio editor layout from package CSS',
)
