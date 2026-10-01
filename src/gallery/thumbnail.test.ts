import type { SeatMapObject } from '@fpass/seat-map/schema'
import { describe, expect, it, vi } from 'vitest'

import { buildExampleSchemes } from '../examples/exampleSchemes'
import { createStudioScheme, type StudioSchemeFile } from '../schemes/library'
import {
  cachedThumbnailDrawList,
  clearThumbnailCache,
  paintThumbnail,
  thumbnailDrawList,
  type ThumbnailCommand,
  THUMBNAIL_CACHE_LIMIT,
} from './thumbnail'

const SIZE = { width: 240, height: 150 }

function scheme(objects: SeatMapObject[], canvas = { width: 1000, height: 500 }): StudioSchemeFile {
  const file = createStudioScheme('Зал').file

  return {
    ...file,
    schema_json: {
      ...file.schema_json,
      canvas,
      price_groups: [{ key: 'vip', name: 'VIP', color: '#e11d48', price_amount: 500000 }],
    },
    objects,
  }
}

function ofKind<K extends ThumbnailCommand['kind']>(commands: ThumbnailCommand[], kind: K): Extract<ThumbnailCommand, { kind: K }>[] {
  return commands.filter((command): command is Extract<ThumbnailCommand, { kind: K }> => command.kind === kind)
}

function fakeContext(): CanvasRenderingContext2D {
  const noop = () => undefined
  return new Proxy({}, { get: (_, key) => (key === 'canvas' ? {} : noop), set: () => true }) as unknown as CanvasRenderingContext2D
}

describe('thumbnailDrawList', () => {
  it('fits the scheme canvas into the thumbnail keeping aspect and padding', () => {
    const commands = thumbnailDrawList(scheme([]), SIZE)
    const [frame] = ofKind(commands, 'frame')

    expect(frame.width / frame.height).toBeCloseTo(2)
    expect(frame.x).toBeGreaterThanOrEqual(8)
    expect(frame.y).toBeGreaterThanOrEqual(8)
    expect(frame.x + frame.width).toBeLessThanOrEqual(SIZE.width - 8)
    expect(frame.y + frame.height).toBeLessThanOrEqual(SIZE.height - 8)
    expect(frame.width).toBeCloseTo(SIZE.width - 16)
    expect(frame.y).toBeCloseTo((SIZE.height - frame.height) / 2)
  })

  it('maps scheme coordinates through the fit transform', () => {
    const commands = thumbnailDrawList(scheme([
      { external_key: 'seat-1', type: 'seat', label: '1', x: 1000, y: 500, price_group_key: 'vip' },
    ]), SIZE)
    const [frame] = ofKind(commands, 'frame')
    const [dot] = ofKind(commands, 'dot')

    expect(dot.x).toBeCloseTo(frame.x + frame.width)
    expect(dot.y).toBeCloseTo(frame.y + frame.height)
  })

  it('colours seats and dancefloors by price group and falls back to slate', () => {
    const commands = thumbnailDrawList(scheme([
      { external_key: 'seat-1', type: 'seat', label: '1', x: 10, y: 10, price_group_key: 'vip', color: '#000000' },
      { external_key: 'seat-2', type: 'seat', label: '2', x: 20, y: 10 },
      { external_key: 'floor-1', type: 'dancefloor', label: 'Танцпол', x: 30, y: 10, price_group_key: 'missing' },
    ]), SIZE)

    expect(ofKind(commands, 'dot').map(dot => dot.fill).sort()).toEqual(['#94a3b8', '#94a3b8', '#e11d48'])
  })

  it('draws zones as pale polygons, tables as outlines and skips text', () => {
    const commands = thumbnailDrawList(scheme([
      { external_key: 'zone-1', type: 'zone', label: 'A', x: 0, y: 0, style: { points: [0, 0, 100, 0, 100, 100] } },
      { external_key: 'floor-1', type: 'floor', label: 'B', x: 0, y: 0, width: 200, height: 100 },
      { external_key: 'table-1', type: 'table', label: '1', x: 100, y: 100, width: 60, height: 60, style: { cornerRadius: 999 } },
      { external_key: 'table-2', type: 'table', label: '2', x: 300, y: 100, width: 80, height: 40, style: { cornerRadius: 10 } },
      { external_key: 'text-1', type: 'text', label: 'Надпись', x: 0, y: 0 },
    ]), SIZE)

    expect(ofKind(commands, 'polygon')).toEqual([expect.objectContaining({ fill: '#e2e8f0' })])
    expect(ofKind(commands, 'rect')).toEqual(expect.arrayContaining([
      expect.objectContaining({ fill: '#e2e8f0', stroke: null }),
      expect.objectContaining({ fill: null, stroke: '#94a3b8' }),
    ]))
    expect(ofKind(commands, 'circle')).toEqual([expect.objectContaining({ stroke: '#94a3b8' })])
    expect(commands).toHaveLength(5)
  })

  it('draws territories before objects and dots last', () => {
    const commands = thumbnailDrawList(scheme([
      { external_key: 'seat-1', type: 'seat', label: '1', x: 10, y: 10 },
      { external_key: 'table-1', type: 'table', label: '1', x: 100, y: 100, width: 80, height: 40 },
      { external_key: 'zone-1', type: 'zone', label: 'A', x: 0, y: 0, style: { points: [0, 0, 100, 0, 100, 100] } },
    ]), SIZE)

    expect(commands.map(command => command.kind)).toEqual(['frame', 'polygon', 'rect', 'dot'])
  })

  it('builds and paints the arena thumbnail within 50 ms', () => {
    const arena = buildExampleSchemes().arena
    const started = performance.now()

    paintThumbnail(fakeContext(), thumbnailDrawList(arena, SIZE))

    expect(performance.now() - started).toBeLessThan(50)
  })
})

describe('cachedThumbnailDrawList', () => {
  it('memoises by cache key and evicts the oldest entry', () => {
    clearThumbnailCache()
    const file = scheme([])
    const first = cachedThumbnailDrawList('doc-0:1', file, SIZE)

    expect(cachedThumbnailDrawList('doc-0:1', file, SIZE)).toBe(first)

    for (let index = 1; index <= THUMBNAIL_CACHE_LIMIT; index++) {
      cachedThumbnailDrawList(`doc-${index}:1`, file, SIZE)
    }

    expect(cachedThumbnailDrawList('doc-0:1', file, SIZE)).not.toBe(first)
  })
})

describe('paintThumbnail', () => {
  it('batches consecutive dots of one colour into a single fill', () => {
    const fill = vi.fn()
    const ctx = new Proxy({ fill }, {
      get: (target, key) => (key in target ? target[key as 'fill'] : () => undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D

    paintThumbnail(ctx, [
      { kind: 'dot', x: 1, y: 1, radius: 1, fill: '#e11d48' },
      { kind: 'dot', x: 2, y: 1, radius: 1, fill: '#e11d48' },
      { kind: 'dot', x: 3, y: 1, radius: 1, fill: '#94a3b8' },
    ])

    expect(fill).toHaveBeenCalledTimes(2)
  })
})
