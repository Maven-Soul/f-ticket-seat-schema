<script setup lang="ts">
import { ChevronDown, ChevronUp, Info, Ticket } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import {
  reconcileSeatMapAdmissionSelection,
  SeatMapBookingExperience,
  seatMapAdmissionSummary,
  type SeatMapAdmissionSelection,
} from '@fpass/seat-map/booking'
import { buyerPreviewStates, hasPurchasablePreviewState } from '@fpass/seat-map/studio'

import BuyerOrderList from './BuyerOrderList.vue'
import { admissionLineKey, buyerOrderLines, formatRubles } from './order'
import { applySimulatedSales, simulatedAdmissionAreas, simulatedSectorSummaries, withAdmissionAreaStates } from './simulation'
import { loadBuyerPreviewSnapshot } from './snapshot'

const props = defineProps<{
  documentId: string
  soldPercent: number
}>()

const SELECTION_LIMIT = 10
const DESKTOP_MIN_WIDTH = 1024
const MIN_MAP_HEIGHT = 280
const FALLBACK_CHROME_HEIGHT = 140

const snapshot = shallowRef(loadBuyerPreviewSnapshot(props.documentId))
const selectedKeys = ref<string[]>([])
const admissionSelections = ref<SeatMapAdmissionSelection[]>([])
const sheetOpen = ref(false)
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)
const mapSection = ref<HTMLElement | null>(null)
const measuredMapHeight = ref(0)

const baseStates = computed(() => (
  snapshot.value ? buyerPreviewStates(snapshot.value.objects, snapshot.value.priceGroups) : []
))
const admissionAreas = computed(() => (
  snapshot.value ? simulatedAdmissionAreas(snapshot.value.objects, snapshot.value.priceGroups, props.soldPercent) : []
))
const states = computed(() => withAdmissionAreaStates(applySimulatedSales(baseStates.value, props.soldPercent), admissionAreas.value))
const sectorSummaries = computed(() => (
  snapshot.value ? simulatedSectorSummaries(snapshot.value.objects, states.value) : []
))
const hasPrices = computed(() => hasPurchasablePreviewState(baseStates.value))
const admissionSummary = computed(() => seatMapAdmissionSummary({
  areas: admissionAreas.value,
  selections: admissionSelections.value,
}))
const orderLines = computed(() => (
  snapshot.value ? buyerOrderLines(snapshot.value.objects, states.value, selectedKeys.value, admissionSummary.value.rows) : []
))
const admissionTotal = computed(() => admissionSummary.value.total_quantity)
const ticketTotal = computed(() => selectedKeys.value.length + admissionTotal.value)
const purchasableKeys = computed(() => new Set(states.value.filter(state => state.purchasable).map(state => state.external_key)))
const totalText = computed(() => formatRubles(orderLines.value.reduce((sum, line) => sum + line.amount, 0)))
const ticketCountText = computed(() => `${ticketTotal.value} из ${SELECTION_LIMIT}`)
const isDesktop = computed(() => viewportWidth.value >= DESKTOP_MIN_WIDTH)
const mapHeight = computed(() => Math.max(
  MIN_MAP_HEIGHT,
  measuredMapHeight.value > 0 ? measuredMapHeight.value : viewportHeight.value - FALLBACK_CHROME_HEIGHT,
))
const sheetToggleLabel = computed(() => (sheetOpen.value ? 'Скрыть выбранные места' : 'Показать выбранные места'))

watch(purchasableKeys, (purchasable) => {
  selectedKeys.value = selectedKeys.value.filter(key => purchasable.has(key))
})

watch(admissionAreas, (areas) => {
  admissionSelections.value = reconcileSeatMapAdmissionSelection({ areas, selections: admissionSelections.value })
})

function clearOrder(): void {
  selectedKeys.value = []
  admissionSelections.value = []
  sheetOpen.value = false
}

function removeAdmission(key: string): void {
  admissionSelections.value = admissionSelections.value.filter(selection => admissionLineKey(selection) !== key)
}

function syncViewport(): void {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  measuredMapHeight.value = mapSection.value?.clientHeight ?? 0
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('resize', syncViewport)
  syncViewport()
  if (typeof ResizeObserver !== 'undefined' && mapSection.value) {
    resizeObserver = new ResizeObserver(syncViewport)
    resizeObserver.observe(mapSection.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
  resizeObserver?.disconnect()
})
</script>

<template>
  <main class="flex h-dvh flex-col overflow-hidden bg-white text-slate-900">
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
      <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500 text-sm font-bold text-white">F</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold">{{ snapshot?.name || 'Схема мероприятия' }}</p>
        <p class="truncate text-xs text-slate-500">Выбор мест</p>
      </div>
      <span class="ml-auto shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
        Симуляция
      </span>
    </header>

    <section
      v-if="!snapshot"
      class="grid flex-1 place-items-center bg-slate-50 p-6 text-center"
    >
      <div class="grid max-w-sm justify-items-center gap-3">
        <div class="grid size-12 place-items-center rounded-full bg-sky-50 text-sky-600">
          <Info class="size-6" />
        </div>
        <p class="text-sm text-slate-600">Схема не найдена — откройте предпросмотр из редактора.</p>
      </div>
    </section>

    <template v-else>
      <p
        v-if="!hasPrices"
        class="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
      >
        <Info class="size-4 shrink-0" />
        Ценовые группы не заданы — места показаны как недоступные.
      </p>

      <div class="flex min-h-0 flex-1">
        <section ref="mapSection" class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <SeatMapBookingExperience
            v-model:selected-keys="selectedKeys"
            v-model:admission-selections="admissionSelections"
            :canvas="snapshot.canvas"
            :objects="snapshot.objects"
            :states="states"
            :admission-areas="admissionAreas"
            :display="snapshot.display"
            :sector-summaries="sectorSummaries"
            :height="mapHeight"
            :ticket-limit="SELECTION_LIMIT"
            :show-accessible-list="false"
          />

          <div
            v-if="!isDesktop && sheetOpen"
            data-testid="buyer-order-sheet"
            class="absolute inset-x-0 bottom-0 z-20 grid max-h-[70%] gap-3 overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-slate-50 p-4 shadow-[0_-12px_32px_-12px_rgb(15_23_42/0.25)]"
          >
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold">Ваш заказ</h2>
              <button
                type="button"
                data-testid="buyer-order-clear"
                class="text-sm font-medium text-slate-500 hover:text-red-600 disabled:opacity-40"
                :disabled="orderLines.length === 0"
                @click="clearOrder"
              >
                Очистить
              </button>
            </div>
            <BuyerOrderList :lines="orderLines" @remove="removeAdmission" />
          </div>
        </section>

        <aside
          v-if="isDesktop"
          data-testid="buyer-order-sidebar"
          class="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50"
        >
          <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 class="text-sm font-semibold">Ваш заказ</h2>
              <p class="text-xs text-slate-500">Билетов: {{ ticketCountText }}</p>
            </div>
            <button
              type="button"
              data-testid="buyer-order-clear"
              class="rounded-md px-2 py-1 text-sm font-medium text-slate-500 hover:bg-white hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"
              :disabled="orderLines.length === 0"
              @click="clearOrder"
            >
              Очистить
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <BuyerOrderList :lines="orderLines" @remove="removeAdmission" />
          </div>
          <footer class="grid gap-3 border-t border-slate-200 bg-white p-4">
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm text-slate-500">Итого</span>
              <strong data-testid="buyer-order-total" class="text-xl font-semibold tabular-nums">{{ totalText }}</strong>
            </div>
            <button
              type="button"
              data-testid="buyer-checkout"
              class="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sky-600/50 px-4 text-sm font-semibold text-white"
              disabled
            >
              <Ticket class="size-4" />
              Перейти к оплате (симуляция)
            </button>
          </footer>
        </aside>
      </div>

      <footer
        v-if="!isDesktop"
        data-testid="buyer-order-bar"
        class="relative z-30 flex h-16 shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-4"
      >
        <button
          type="button"
          data-testid="buyer-order-toggle"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
          :aria-expanded="sheetOpen"
          :aria-label="sheetToggleLabel"
          @click="sheetOpen = !sheetOpen"
        >
          <span class="min-w-0">
            <span class="block text-xs text-slate-500">Билетов: {{ ticketCountText }}</span>
            <strong data-testid="buyer-order-total" class="block text-base font-semibold tabular-nums">{{ totalText }}</strong>
          </span>
          <ChevronDown v-if="sheetOpen" class="size-4 shrink-0 text-slate-500" />
          <ChevronUp v-else class="size-4 shrink-0 text-slate-500" />
        </button>
        <button
          type="button"
          data-testid="buyer-checkout"
          class="inline-flex h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-sky-600/50 px-4 text-sm font-semibold text-white"
          aria-label="Перейти к оплате (симуляция)"
          disabled
        >
          <Ticket class="size-4" />
          <span class="hidden sm:inline">Перейти к оплате (симуляция)</span>
          <span class="sm:hidden">К оплате</span>
        </button>
      </footer>
    </template>
  </main>
</template>
