<script setup lang="ts">
import { ChevronDown, Layers } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapObject } from '@fpass/seat-map/schema'

import { formatRubles } from './order'
import { dancefloorCategoryKeys, type BuyerSimulationSettings } from './simulationSettings'

const props = defineProps<{
  objects: SeatMapObject[]
  priceGroups: SeatMapPricingGroupOption[]
  modelValue: BuyerSimulationSettings
}>()

const emit = defineEmits<{
  'update:modelValue': [settings: BuyerSimulationSettings]
}>()

interface CategoryOption {
  groupKey: string
  name: string
  priceText: string
  colorStyle: { backgroundColor: string }
  checked: boolean
  disabled: boolean
  testId: string
}

interface DancefloorBlock {
  key: string
  label: string
  options: CategoryOption[]
}

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const blocks = computed<DancefloorBlock[]>(() => props.objects
  .filter(object => object.type === 'dancefloor')
  .map((object) => {
    const checked = new Set(dancefloorCategoryKeys(object, props.modelValue, props.priceGroups))

    return {
      key: object.external_key,
      label: object.label?.trim() || 'Танцпол',
      options: props.priceGroups.map(group => ({
        groupKey: group.key,
        name: group.name,
        priceText: formatRubles(group.price_amount),
        colorStyle: { backgroundColor: group.color },
        checked: checked.has(group.key),
        disabled: checked.size === 1 && checked.has(group.key),
        testId: `dancefloor-category-${object.external_key}-${group.key}`,
      })),
    }
  }))
const hasBlocks = computed(() => blocks.value.length > 0)

function toggle(block: DancefloorBlock, groupKey: string, checked: boolean): void {
  const selected = new Set(block.options.filter(option => option.checked).map(option => option.groupKey))
  if (checked) selected.add(groupKey)
  else selected.delete(groupKey)

  emit('update:modelValue', {
    dancefloorCategories: {
      ...props.modelValue.dancefloorCategories,
      [block.key]: props.priceGroups.map(group => group.key).filter(key => selected.has(key)),
    },
  })
}

function onChange(block: DancefloorBlock, groupKey: string, event: Event): void {
  toggle(block, groupKey, (event.target as HTMLInputElement).checked)
}

function closeOnOutside(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close()
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

function close(): void {
  open.value = false
  window.removeEventListener('pointerdown', closeOnOutside)
  window.removeEventListener('keydown', closeOnEscape)
}

function toggleOpen(): void {
  if (open.value) {
    close()
    return
  }

  open.value = true
  window.addEventListener('pointerdown', closeOnOutside)
  window.addEventListener('keydown', closeOnEscape)
}

onBeforeUnmount(close)
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      data-testid="dancefloor-categories-trigger"
      class="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-sm font-medium hover:bg-slate-50"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <Layers class="size-4" />
      Категории танцполов
      <ChevronDown class="size-4 text-slate-500" />
    </button>

    <div
      v-if="open"
      data-testid="dancefloor-categories-panel"
      role="dialog"
      aria-label="Категории танцполов"
      class="absolute left-0 top-full z-40 mt-2 grid max-h-96 w-80 gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
    >
      <p class="text-xs text-slate-500">Какие ценовые группы продаются на каждом танцполе. Покупатель выбирает категорию в окне выбора билетов.</p>
      <p v-if="!hasBlocks" class="text-sm text-slate-500">На схеме нет танцполов.</p>
      <section
        v-for="block in blocks"
        :key="block.key"
        data-testid="dancefloor-categories-block"
        class="grid gap-1"
      >
        <h3 class="text-sm font-semibold text-slate-900">{{ block.label }}</h3>
        <label
          v-for="option in block.options"
          :key="option.groupKey"
          class="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-slate-50 has-disabled:cursor-not-allowed"
        >
          <input
            type="checkbox"
            class="size-4 accent-sky-600"
            :data-testid="option.testId"
            :checked="option.checked"
            :disabled="option.disabled"
            @change="onChange(block, option.groupKey, $event)"
          >
          <span data-testid="dancefloor-category-color" class="size-2.5 shrink-0 rounded-full" :style="option.colorStyle" />
          <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
          <span class="shrink-0 tabular-nums text-slate-500">{{ option.priceText }}</span>
        </label>
      </section>
    </div>
  </div>
</template>
