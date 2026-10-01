<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'

import { buyerFrameHash, studioUrl } from '../route'
import DancefloorCategoriesPopover from './DancefloorCategoriesPopover.vue'
import { BUYER_DEVICES, SOLD_PERCENT_OPTIONS, type BuyerDevice } from './devices'
import { loadSimulationSettings, saveSimulationSettings, type BuyerSimulationSettings } from './simulationSettings'
import type { BuyerPreviewSnapshot } from './snapshot'
import { useDeviceFrame } from './useDeviceFrame'

const props = defineProps<{
  documentId: string
  snapshot: BuyerPreviewSnapshot | null
  reloadToken: number
}>()

const simulationSettings = shallowRef(loadSimulationSettings(props.documentId))
const deviceId = ref<BuyerDevice['id']>('laptop')
const soldPercent = ref<number>(0)
const stage = ref<HTMLElement | null>(null)

const device = computed(() => BUYER_DEVICES.find(candidate => candidate.id === deviceId.value) ?? BUYER_DEVICES[0])
const { frameWidth, frameHeight, frameBoxStyle, frameStyle, sizeCaption } = useDeviceFrame(device, stage)
const frameSrc = computed(() => studioUrl(buyerFrameHash(props.documentId, soldPercent.value)))
const frameKey = computed(() => `${soldPercent.value}:${props.reloadToken}`)
const hasDancefloors = computed(() => props.snapshot?.objects.some(object => object.type === 'dancefloor') ?? false)
const stageClass = computed(() => (device.value.size ? 'grid place-items-center p-6' : ''))
const frameBoxClass = computed(() => (device.value.size ? 'rounded-xl shadow-xl ring-1 ring-slate-900/10' : ''))

function segmentClass(active: boolean): string {
  return active
    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
}

function updateSimulationSettings(settings: BuyerSimulationSettings): void {
  simulationSettings.value = settings
  saveSimulationSettings(props.documentId, settings)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-slate-100 text-slate-900">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-slate-200 bg-white px-3 py-2">
      <div class="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Размер экрана покупателя">
        <button
          v-for="option in BUYER_DEVICES"
          :key="option.id"
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium transition-colors"
          :class="segmentClass(option.id === deviceId)"
          :aria-pressed="option.id === deviceId"
          @click="deviceId = option.id"
        >
          <component :is="option.icon" class="size-4" />
          {{ option.label }}
        </button>
      </div>

      <div class="inline-flex items-center gap-2" role="group" aria-label="Продано мест">
        <span class="text-sm text-slate-500">Продано:</span>
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

      <div class="ml-auto flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>

    <section
      ref="stage"
      class="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] bg-size-[16px_16px]"
      :class="stageClass"
    >
      <span class="pointer-events-none absolute right-3 bottom-2 z-10 rounded-md bg-white/85 px-2 py-0.5 text-xs tabular-nums text-slate-500 shadow-sm">
        {{ sizeCaption }}
      </span>
      <div class="overflow-hidden bg-white" :class="frameBoxClass" :style="frameBoxStyle">
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
  </div>
</template>
