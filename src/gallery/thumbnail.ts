import type { SeatMapObject } from '@fpass/seat-map/schema'

import type { StudioSchemeFile } from '../schemes/library'

export type ThumbnailCommand =
  | { kind: 'frame'; x: number; y: number; width: number; height: number; fill: string }
  | { kind: 'polygon'; points: number[]; fill: string }
  | { kind: 'path'; x: number; y: number; scale: number; path: string; fill: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation: number; fill: string | null; stroke: string | null }
  | { kind: 'circle'; x: number; y: number; radius: number; stroke: string }
  | { kind: 'dot'; x: number; y: number; radius: number; fill: string }

export interface ThumbnailSize {
  width: number
  height: number
}

interface FitTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export const THUMBNAIL_CACHE_LIMIT = 50

const PADDING = 8
const TERRITORY_FILL = '#e2e8f0'
const OBJECT_FILL = '#cbd5e1'
const OUTLINE = '#94a3b8'
const DOT_FALLBACK = '#94a3b8'
const SEAT_RADIUS = 7
const DEFAULT_SIZE: Partial<Record<string, ThumbnailSize>> = {
  zone: { width: 110, height: 64 },
  floor: { width: 110, height: 64 },
  table: { width: 90, height: 56 },
  stage: { width: 300, height: 72 },
  bar: { width: 40, height: 200 },
}

const cache = new Map<string, ThumbnailCommand[]>()

function fitTransform(canvas: ThumbnailSize, size: ThumbnailSize): FitTransform {
  const scale = Math.min(
    (size.width - PADDING * 2) / Math.max(1, canvas.width),
    (size.height - PADDING * 2) / Math.max(1, canvas.height),
  )

  return {
    scale,
    offsetX: (size.width - canvas.width * scale) / 2,
    offsetY: (size.height - canvas.height * scale) / 2,
  }
}

function isTerritory(object: SeatMapObject): boolean {
  return object.type === 'zone' || object.type === 'floor'
}

function styleNumber(object: SeatMapObject, key: string): number | null {
  const value = object.style?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function polygonPoints(object: SeatMapObject): number[] | null {
  const points = object.style?.points
  return Array.isArray(points) && points.length >= 6 ? points.map(Number) : null
}

function objectSize(object: SeatMapObject): ThumbnailSize {
  const fallback = DEFAULT_SIZE[object.type] ?? { width: 110, height: 16 }
  return { width: object.width ?? fallback.width, height: object.height ?? fallback.height }
}

function shapeCommand(object: SeatMapObject, fit: FitTransform): ThumbnailCommand {
  const territory = isTerritory(object)
  const points = polygonPoints(object)
  if (points !== null) {
    return {
      kind: 'polygon',
      points: points.map((value, index) => value * fit.scale + (index % 2 === 0 ? fit.offsetX : fit.offsetY)),
      fill: territory ? TERRITORY_FILL : OBJECT_FILL,
    }
  }

  const path = object.style?.path
  const x = object.x * fit.scale + fit.offsetX
  const y = object.y * fit.scale + fit.offsetY
  if (territory && typeof path === 'string' && path.trim() !== '') {
    return { kind: 'path', x, y, scale: fit.scale, path, fill: TERRITORY_FILL }
  }

  const size = objectSize(object)
  const width = size.width * fit.scale
  const height = size.height * fit.scale
  const rotation = object.rotation ?? 0
  const round = (styleNumber(object, 'cornerRadius') ?? 0) * 2 >= Math.min(size.width, size.height)
  if (object.type === 'table' && round && size.width === size.height && rotation === 0) {
    return { kind: 'circle', x: x + width / 2, y: y + height / 2, radius: width / 2, stroke: OUTLINE }
  }

  if (object.type === 'table') {
    return { kind: 'rect', x, y, width, height, rotation, fill: null, stroke: OUTLINE }
  }

  return { kind: 'rect', x, y, width, height, rotation, fill: territory ? TERRITORY_FILL : OBJECT_FILL, stroke: null }
}

export function thumbnailDrawList(file: StudioSchemeFile, size: ThumbnailSize): ThumbnailCommand[] {
  const canvas = file.schema_json.canvas
  const fit = fitTransform(canvas, size)
  const groupColors = new Map(file.schema_json.price_groups.map(group => [group.key, group.color]))
  const radius = Math.min(3, Math.max(0.8, SEAT_RADIUS * fit.scale))
  const territories: ThumbnailCommand[] = []
  const shapes: ThumbnailCommand[] = []
  const dotsByFill = new Map<string, ThumbnailCommand[]>()

  for (const object of file.objects) {
    if (object.type === 'text') continue

    if (object.type === 'seat' || object.type === 'dancefloor') {
      const fill = groupColors.get(object.price_group_key ?? '') ?? DOT_FALLBACK
      const dot: ThumbnailCommand = { kind: 'dot', x: object.x * fit.scale + fit.offsetX, y: object.y * fit.scale + fit.offsetY, radius, fill }
      const bucket = dotsByFill.get(fill)
      if (bucket) bucket.push(dot)
      else dotsByFill.set(fill, [dot])
      continue
    }

    const target = isTerritory(object) ? territories : shapes
    target.push(shapeCommand(object, fit))
  }

  const frame: ThumbnailCommand = {
    kind: 'frame',
    x: fit.offsetX,
    y: fit.offsetY,
    width: canvas.width * fit.scale,
    height: canvas.height * fit.scale,
    fill: canvas.background ?? '#ffffff',
  }

  return [frame, ...territories, ...shapes, ...[...dotsByFill.values()].flat()]
}

export function cachedThumbnailDrawList(key: string, file: StudioSchemeFile, size: ThumbnailSize): ThumbnailCommand[] {
  const cached = cache.get(key)
  if (cached) return cached

  const commands = thumbnailDrawList(file, size)
  cache.set(key, commands)
  if (cache.size > THUMBNAIL_CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }

  return commands
}

export function clearThumbnailCache(): void {
  cache.clear()
}

function paintShape(ctx: CanvasRenderingContext2D, command: Exclude<ThumbnailCommand, { kind: 'dot' }>): void {
  if (command.kind === 'frame') {
    ctx.fillStyle = command.fill
    ctx.fillRect(command.x, command.y, command.width, command.height)
    ctx.strokeStyle = TERRITORY_FILL
    ctx.strokeRect(command.x, command.y, command.width, command.height)
  } else if (command.kind === 'polygon') {
    ctx.fillStyle = command.fill
    ctx.beginPath()
    ctx.moveTo(command.points[0] ?? 0, command.points[1] ?? 0)
    for (let index = 2; index + 1 < command.points.length; index += 2) {
      ctx.lineTo(command.points[index]!, command.points[index + 1]!)
    }
    ctx.closePath()
    ctx.fill()
  } else if (command.kind === 'path') {
    if (typeof Path2D !== 'function') return
    ctx.save()
    ctx.translate(command.x, command.y)
    ctx.scale(command.scale, command.scale)
    ctx.fillStyle = command.fill
    ctx.fill(new Path2D(command.path))
    ctx.restore()
  } else if (command.kind === 'circle') {
    ctx.strokeStyle = command.stroke
    ctx.beginPath()
    ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.save()
    ctx.translate(command.x, command.y)
    ctx.rotate((command.rotation * Math.PI) / 180)
    if (command.fill !== null) {
      ctx.fillStyle = command.fill
      ctx.fillRect(0, 0, command.width, command.height)
    }
    if (command.stroke !== null) {
      ctx.strokeStyle = command.stroke
      ctx.strokeRect(0, 0, command.width, command.height)
    }
    ctx.restore()
  }
}

export function paintThumbnail(ctx: CanvasRenderingContext2D, commands: readonly ThumbnailCommand[]): void {
  ctx.lineWidth = 1
  let dotFill: string | null = null
  const flushDots = (): void => {
    if (dotFill === null) return
    ctx.fillStyle = dotFill
    ctx.fill()
    dotFill = null
  }

  for (const command of commands) {
    if (command.kind !== 'dot') {
      flushDots()
      paintShape(ctx, command)
      continue
    }

    if (command.fill !== dotFill) {
      flushDots()
      dotFill = command.fill
      ctx.beginPath()
    }
    ctx.moveTo(command.x + command.radius, command.y)
    ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2)
  }
  flushDots()
}
