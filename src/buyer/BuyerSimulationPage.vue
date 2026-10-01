<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import { computed, ref, shallowRef } from 'vue'

import BuyerDeviceStage from './BuyerDeviceStage.vue'
import { loadBuyerPreviewSnapshot } from './snapshot'

const props = defineProps<{
  documentId: string
}>()

const snapshot = shallowRef(loadBuyerPreviewSnapshot(props.documentId))
const reloadToken = ref(0)

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

function refreshFromEditor(): void {
  snapshot.value = loadBuyerPreviewSnapshot(props.documentId)
  reloadToken.value += 1
}
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

    <BuyerDeviceStage :document-id="documentId" :snapshot="snapshot" :reload-token="reloadToken" />
  </main>
</template>
