<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, type CSSProperties } from 'vue'

import { buyerFrameHash, studioUrl } from '../route'
import DancefloorCategoriesPopover from './DancefloorCategoriesPopover.vue'
import { BUYER_DEVICES, fitScale, SOLD_PERCENT_OPTIONS, type BuyerDevice } from './devices'
import { loadSimulationSettings, saveSimulationSettings, type BuyerSimulationSettings } from './simulationSettings'
import { loadBuyerPreviewSnapshot } from './snapshot'

const props = defineProps<{
  documentId: string
}>()

const STAGE_PADDING = 24

const snapshot = shallowRef(loadBuyerPreviewSnapshot(props.documentId))
const simulationSettings = shallowRef(loadSimulationSettings(props.documentId))
const deviceId = ref<BuyerDevice['id']>('laptop')
const soldPercent = ref<number>(0)
const reloadToken = ref(0)
const stage = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 0, height: 0 })

const device = computed(() => BUYER_DEVICES.find(candidate => candidate.id === deviceId.value) ?? BUYER_DEVICES[0])
const frameSrc = computed(() => studioUrl(buyerFrameHash(props.documentId, soldPercent.value)))
const frameKey = computed(() => `${soldPercent.value}:${reloadToken.value}`)
const scale = computed(() => {
  const size = device.value.size
  return size === null ? 1 : fitScale(size, {
    width: stageSize.value.width - STAGE_PADDING * 2,
    height: stageSize.value.height - STAGE_PADDING * 2,
  })
})
const frameWidth = computed(() => (device.value.size ? String(device.value.size.width) : '100%'))
const frameHeight = computed(() => (device.value.size ? String(device.value.size.height) : '100%'))
const frameBoxStyle = computed<CSSProperties>(() => {
  const size = device.value.size
  return size === null
    ? { width: '100%', height: '100%' }
    : { width: `${size.width * scale.value}px`, height: `${size.height * scale.value}px` }
})
const frameStyle = computed<CSSProperties>(() => {
  const size = device.value.size
  return size === null
    ? { width: '100%', height: '100%' }
    : { width: `${size.width}px`, height: `${size.height}px`, transform: `scale(${scale.value})` }
})
const sizeCaption = computed(() => {
  const size = device.value.size
  return size === null
    ? 'Во всё окно · 100%'
    : `${size.width} × ${size.height} · масштаб ${Math.round(scale.value * 100)}%`
})
const hasDancefloors = computed(() => snapshot.value?.objects.some(object => object.type === 'dancefloor') ?? false)
const schemeCaption = computed(() => snapshot.value?.name || 'Схема не найдена')
const snapshotCaption = computed(() => {
  if (!snapshot.value) {
    return 'Откройте предпросмотр покупателя из редактора'
  }

  const time = new Date(snapshot.value.createdAt)
  return Number.isNaN(time.getTime())
    ? 'Снимок из редактора'
    : `Снимок из редактора от ${time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
})

function segmentClass(active: boolean): string {
  return active
    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
}

function updateSimulationSettings(settings: BuyerSimulationSettings): void {
  simulationSettings.value = settings
  saveSimulationSettings(props.documentId, settings)
}

function refreshFromEditor(): void {
  snapshot.value = loadBuyerPreviewSnapshot(props.documentId)
  reloadToken.value += 1
}

function measureStage(): void {
  stageSize.value = {
    width: stage.value?.clientWidth ?? 0,
    height: stage.value?.clientHeight ?? 0,
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measureStage()
  window.addEventListener('resize', measureStage)
  if (typeof ResizeObserver !== 'undefined' && stage.value) {
    resizeObserver = new ResizeObserver(measureStage)
    resizeObserver.observe(stage.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measureStage)
  resizeObserver?.disconnect()
})
</script>

<template>
  <main class="flex h-dvh min-h-0 flex-col bg-slate-100 text-slate-900">
    <header class="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500 text-xl font-bold text-white">F</div>
      <div class="mr-auto min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-sky-700">Симуляция покупателя</p>
        <h1 class="truncate text-base font-semibold">{{ schemeCaption }}</h1>
        <p class="truncate text-xs text-slate-500">{{ snapshotCaption }}</p>
      </div>
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"
        @click="refreshFromEditor"
      >
        <RefreshCw class="size-4" />
        Обновить из редактора
      </button>
    </header>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2">
      <div class="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Размер экрана покупателя">
        <button
          v-for="option in BUYER_DEVICES"
          :key="option.id"
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors"
          :class="segmentClass(option.id === deviceId)"
          :aria-pressed="option.id === deviceId"
          @click="deviceId = option.id"
        >
          <component :is="option.icon" class="size-4" />
          {{ option.label }}
        </button>
      </div>

      <div class="inline-flex items-center gap-2" role="group" aria-label="Продано мест">
        <span class="text-sm text-slate-500">Продано мест:</span>
        <div class="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            v-for="percent in SOLD_PERCENT_OPTIONS"
            :key="percent"
            type="button"
            class="h-8 rounded-md px-2.5 text-sm font-medium tabular-nums transition-colors"
            :class="segmentClass(percent === soldPercent)"
            :aria-pressed="percent === soldPercent"
            @click="soldPercent = percent"
          >
            {{ percent }}%
          </button>
        </div>
      </div>

      <DancefloorCategoriesPopover
        v-if="snapshot && hasDancefloors"
        :objects="snapshot.objects"
        :price-groups="snapshot.priceGroups"
        :model-value="simulationSettings"
        @update:model-value="updateSimulationSettings"
      />

      <span class="ml-auto text-sm tabular-nums text-slate-500">{{ sizeCaption }}</span>
    </div>

    <section
      ref="stage"
      class="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] bg-size-[16px_16px]"
      :class="device.size ? 'grid place-items-center p-6' : ''"
    >
      <div
        class="overflow-hidden bg-white"
        :class="device.size ? 'rounded-xl shadow-xl ring-1 ring-slate-900/10' : ''"
        :style="frameBoxStyle"
      >
        <iframe
          :key="frameKey"
          :src="frameSrc"
          :width="frameWidth"
          :height="frameHeight"
          :style="frameStyle"
          title="Экран покупателя"
          class="block origin-top-left border-0"
        />
      </div>
    </section>
  </main>
</template>
