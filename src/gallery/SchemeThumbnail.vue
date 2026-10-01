<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import type { StudioSchemeFile } from '../schemes/library'
import { cachedThumbnailDrawList, paintThumbnail, type ThumbnailSize } from './thumbnail'

const props = defineProps<{
  file: StudioSchemeFile
  cacheKey: string
}>()

const SIZE: ThumbnailSize = { width: 240, height: 150 }

const canvas = ref<HTMLCanvasElement | null>(null)

function context(element: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return element.getContext('2d')
  } catch {
    return null
  }
}

function paint(): void {
  const element = canvas.value
  const ctx = element ? context(element) : null
  if (!element || !ctx) return

  const ratio = window.devicePixelRatio || 1
  element.width = Math.round(SIZE.width * ratio)
  element.height = Math.round(SIZE.height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, SIZE.width, SIZE.height)
  paintThumbnail(ctx, cachedThumbnailDrawList(props.cacheKey, props.file, SIZE))
}

onMounted(paint)
watch(() => props.cacheKey, paint)
</script>

<template>
  <canvas
    ref="canvas"
    :width="SIZE.width"
    :height="SIZE.height"
    aria-hidden="true"
    class="block aspect-[8/5] h-auto w-full"
  />
</template>
