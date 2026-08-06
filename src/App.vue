<script setup lang="ts">
import { Download, FileUp, Layers3 } from '@lucide/vue'
import { computed, ref } from 'vue'

import { SeatMapEditor } from '@fpass/seat-map/studio'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapObject } from '@fpass/seat-map/schema'

interface StudioFile {
  format: 'fpass-seat-map'
  version: 2
  scheme: {
    name: string
    group_name: string | null
  }
  schema_json: {
    canvas: SeatMapCanvasSize
    price_groups: SeatMapPricingGroupOption[]
    sections: []
  }
  objects: SeatMapObject[]
}

const fileInput = ref<HTMLInputElement | null>(null)
const name = ref('Новая схема')
const groupName = ref('')
const documentKey = ref(0)
const importError = ref('')
const exportedAt = ref<string | null>(null)
const editorState = ref({
  canvas: { width: 1200, height: 800, background: '#ffffff' } as SeatMapCanvasSize,
  objects: [] as SeatMapObject[],
  priceGroups: [] as SeatMapPricingGroupOption[],
})

const filename = computed(() => {
  const slug = name.value.trim().toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '')
  return `${slug || 'fpass-scheme'}.json`
})

function updateEditorState(canvas: SeatMapCanvasSize, objects: SeatMapObject[], priceGroups: SeatMapPricingGroupOption[]): void {
  editorState.value = { canvas, objects, priceGroups }
}

function makePayload(canvas = editorState.value.canvas, objects = editorState.value.objects, priceGroups = editorState.value.priceGroups): StudioFile {
  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme: {
      name: name.value.trim() || 'Без названия',
      group_name: groupName.value.trim() || null,
    },
    schema_json: { canvas, price_groups: priceGroups, sections: [] },
    objects,
  }
}

function download(canvas: SeatMapCanvasSize, objects: SeatMapObject[], priceGroups: SeatMapPricingGroupOption[]): void {
  updateEditorState(canvas, objects, priceGroups)
  const blob = new Blob([JSON.stringify(makePayload(canvas, objects, priceGroups), null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.value
  anchor.click()
  URL.revokeObjectURL(url)
  exportedAt.value = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

async function openFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const raw: unknown = JSON.parse(await file.text())
    if (!isStudioFile(raw)) throw new Error('Поддерживаются только файлы FPass Scheme Studio версии 2.')

    name.value = raw.scheme.name
    groupName.value = raw.scheme.group_name ?? ''
    editorState.value = {
      canvas: raw.schema_json.canvas,
      objects: raw.objects,
      priceGroups: raw.schema_json.price_groups,
    }
    documentKey.value += 1
    importError.value = ''
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Не удалось открыть JSON-файл.'
  }
}

function isStudioFile(value: unknown): value is StudioFile {
  if (typeof value !== 'object' || value === null) return false
  const file = value as Partial<StudioFile>

  return file.format === 'fpass-seat-map'
    && file.version === 2
    && typeof file.scheme?.name === 'string'
    && typeof file.schema_json?.canvas?.width === 'number'
    && typeof file.schema_json?.canvas?.height === 'number'
    && Array.isArray(file.schema_json?.price_groups)
    && Array.isArray(file.objects)
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 p-3 md:p-5">
    <section class="mx-auto grid max-w-[1800px] gap-3">
      <header class="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div class="grid size-9 place-items-center rounded-lg bg-sky-500 text-xl font-bold text-white">F</div>
        <div class="mr-auto">
          <h1 class="text-base font-semibold">FPass Scheme Studio</h1>
          <p class="text-sm text-slate-500">Редактор интерактивных схем · JSON v2</p>
        </div>
        <input ref="fileInput" class="hidden" type="file" accept="application/json,.json" @change="openFile">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50" @click="fileInput?.click()">
          <FileUp class="size-4" />Открыть JSON
        </button>
      </header>

      <section class="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label class="grid gap-1.5 text-sm font-medium">
          Название схемы
          <input v-model="name" class="h-10 rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label class="grid gap-1.5 text-sm font-medium">
          Группа схем
          <input v-model="groupName" class="h-10 rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-sky-500" placeholder="Например: Театры" />
        </label>
        <p v-if="exportedAt" class="pb-2 text-sm text-slate-500">Экспортировано в {{ exportedAt }}</p>
      </section>

      <p v-if="importError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ importError }}</p>

      <SeatMapEditor
        :key="documentKey"
        storage-key="fpass-scheme-studio:draft"
        :initial-canvas="editorState.canvas"
        :initial-objects="editorState.objects"
        :initial-price-groups="editorState.priceGroups"
        :external-file-handling="true"
        @save="updateEditorState"
        @export="download"
      />

      <footer class="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        <span>Готовый файл загружается в админке FPass владельцем платформы.</span>
        <span class="inline-flex items-center gap-1.5"><Layers3 class="size-4" />JSON v2</span>
      </footer>
    </section>
  </main>
</template>
