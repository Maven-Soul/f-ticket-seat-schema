<script setup lang="ts">
import { FileUp, Layers3, Plus, Trash2 } from '@lucide/vue'
import { computed, ref, shallowRef } from 'vue'

import { SeatMapEditor } from '@fpass/seat-map/studio'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapObject } from '@fpass/seat-map/schema'
import {
  canonicalizeStudioSchemeIdentity,
  createStudioScheme,
  loadStudioSchemes,
  parseStudioSchemeFile,
  saveStudioSchemes,
  STUDIO_SCHEME_IDENTITY_ERROR,
  type StoredStudioScheme,
  type StudioSchemeFile,
} from './schemes/library'

const LOAD_ERROR = 'Не удалось загрузить схемы из локального хранилища.'
const SAVE_ERROR = 'Не удалось сохранить схемы в локальном хранилище. Повторите действие.'

const fileInput = ref<HTMLInputElement | null>(null)
const persistenceError = ref('')
const identityError = ref('')
const documents = shallowRef<StoredStudioScheme[]>(loadDocuments())
const activeId = ref<string | null>(documents.value[0]?.id ?? null)
const importError = ref('')
const exportedAt = ref<string | null>(null)

function loadDocuments(): StoredStudioScheme[] {
  try {
    return loadStudioSchemes()
  } catch {
    persistenceError.value = LOAD_ERROR
    return []
  }
}

const activeDocument = computed(() => (
  documents.value.find(document => document.id === activeId.value) ?? null
))

function persist(nextDocuments: StoredStudioScheme[]): boolean {
  try {
    saveStudioSchemes(nextDocuments)
    documents.value = nextDocuments
    persistenceError.value = ''
    return true
  } catch {
    persistenceError.value = SAVE_ERROR
    return false
  }
}

function createUniqueDocument(file?: StudioSchemeFile): StoredStudioScheme {
  const occupiedIds = new Set(documents.value.map(document => document.id))
  let document = createStudioScheme(file?.scheme.name)

  while (occupiedIds.has(document.id)) {
    document = createStudioScheme(file?.scheme.name)
  }

  return file ? { ...document, file } : document
}

function createDocument(): void {
  const document = createUniqueDocument()
  if (!persist([...documents.value, document])) {
    return
  }

  activeId.value = document.id
  importError.value = ''
  identityError.value = ''
  exportedAt.value = null
}

function selectDocument(id: string): void {
  activeId.value = id
  importError.value = ''
  identityError.value = ''
  exportedAt.value = null
}

function updateActiveFile(
  update: (file: StudioSchemeFile) => StudioSchemeFile,
): StoredStudioScheme | null {
  const id = activeId.value
  if (id === null) {
    return null
  }

  let updatedDocument: StoredStudioScheme | null = null
  const nextDocuments = documents.value.map((document) => {
    if (document.id !== id) {
      return document
    }

    updatedDocument = {
      ...document,
      updatedAt: new Date().toISOString(),
      file: update(document.file),
    }

    return updatedDocument
  })

  if (updatedDocument !== null) {
    return persist(nextDocuments) ? updatedDocument : null
  }

  return null
}

function updateName(event: Event): void {
  const name = (event.target as HTMLInputElement).value
  const document = activeDocument.value
  if (document === null) {
    return
  }

  let scheme: StudioSchemeFile['scheme']
  try {
    scheme = canonicalizeStudioSchemeIdentity(name, document.file.scheme.group_name)
    identityError.value = ''
  } catch {
    identityError.value = STUDIO_SCHEME_IDENTITY_ERROR
    return
  }

  updateActiveFile(file => ({
    ...file,
    scheme,
  }))
}

function updateGroupName(event: Event): void {
  const groupName = (event.target as HTMLInputElement).value
  const document = activeDocument.value
  if (document === null) {
    return
  }

  let scheme: StudioSchemeFile['scheme']
  try {
    scheme = canonicalizeStudioSchemeIdentity(document.file.scheme.name, groupName)
    identityError.value = ''
  } catch {
    identityError.value = STUDIO_SCHEME_IDENTITY_ERROR
    return
  }

  updateActiveFile(file => ({
    ...file,
    scheme,
  }))
}

function withoutLegacyCapacity(objects: SeatMapObject[]): SeatMapObject[] {
  return objects.map((object) => {
    const capacityFreeObject = { ...object }
    delete capacityFreeObject.capacity
    return capacityFreeObject
  })
}

function updateEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
): StoredStudioScheme | null {
  if (identityError.value !== '') {
    return null
  }

  return updateActiveFile(file => ({
    ...file,
    schema_json: {
      canvas,
      price_groups: priceGroups,
      sections: [],
    },
    objects: withoutLegacyCapacity(objects),
  }))
}

function filenameFor(file: StudioSchemeFile): string {
  const slug = file.scheme.name
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')

  return `${slug || 'fpass-scheme'}.json`
}

function downloadFile(file: StudioSchemeFile): void {
  const blob = new Blob(
    [JSON.stringify(file, null, 2)],
    { type: 'application/json;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filenameFor(file)
  anchor.click()
  URL.revokeObjectURL(url)
  exportedAt.value = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function saveEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
): void {
  updateEditorState(canvas, objects, priceGroups)
}

function exportEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
): void {
  const document = updateEditorState(canvas, objects, priceGroups)
  if (document !== null) {
    downloadFile(document.file)
  }
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  try {
    let raw: unknown = null
    try {
      raw = JSON.parse(await file.text())
    } catch {
      raw = null
    }

    const parsed = parseStudioSchemeFile(raw)
    const document = createUniqueDocument(parsed)
    if (!persist([...documents.value, document])) {
      return
    }

    activeId.value = document.id
    importError.value = ''
    identityError.value = ''
    exportedAt.value = null
  } catch (error) {
    importError.value = error instanceof Error
      ? error.message
      : 'Не удалось открыть JSON-файл.'
  }
}

function deleteDocument(id: string): void {
  const index = documents.value.findIndex(document => document.id === id)
  if (index < 0) {
    return
  }

  const document = documents.value[index]
  if (!confirm(`Удалить схему «${document.file.scheme.name || 'Без названия'}»?`)) {
    return
  }

  const nextDocuments = documents.value.filter(candidate => candidate.id !== id)
  if (!persist(nextDocuments)) {
    return
  }

  if (activeId.value === id) {
    activeId.value = nextDocuments[Math.min(index, nextDocuments.length - 1)]?.id ?? null
  }

  importError.value = ''
  identityError.value = ''
  exportedAt.value = null
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 p-3 md:p-5">
    <section class="mx-auto grid max-w-[1800px] gap-3">
      <header class="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div class="grid size-9 place-items-center rounded-lg bg-sky-500 text-xl font-bold text-white">F</div>
        <div class="mr-auto">
          <h1 class="text-base font-semibold">FPass Scheme Studio</h1>
          <p class="text-sm text-slate-500">Локальная библиотека интерактивных схем · JSON v2</p>
        </div>
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept="application/json,.json"
          @change="importFile"
        >
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
          @click="fileInput?.click()"
        >
          <FileUp class="size-4" />
          Открыть JSON
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700"
          @click="createDocument"
        >
          <Plus class="size-4" />
          Создать схему
        </button>
      </header>

      <p
        v-if="persistenceError"
        data-testid="persistence-error"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ persistenceError }}
      </p>

      <p
        v-if="importError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ importError }}
      </p>

      <section class="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside class="grid gap-3 rounded-xl border bg-white p-3 shadow-sm">
          <header class="flex items-center justify-between gap-3 px-1">
            <div>
              <h2 class="text-sm font-semibold">Мои схемы</h2>
              <p class="text-xs text-slate-500">Хранятся только в этом браузере</p>
            </div>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {{ documents.length }}
            </span>
          </header>

          <div v-if="documents.length > 0" class="grid gap-2">
            <article
              v-for="document in documents"
              :key="document.id"
              data-testid="studio-document"
              class="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-1 rounded-lg border p-1"
              :class="document.id === activeId ? 'border-sky-300 bg-sky-50' : 'bg-white'"
            >
              <button
                type="button"
                class="min-w-0 rounded-md px-2 py-2 text-left hover:bg-white"
                :aria-pressed="document.id === activeId"
                @click="selectDocument(document.id)"
              >
                <span class="block truncate text-sm font-medium">
                  {{ document.file.scheme.name || 'Без названия' }}
                </span>
                <span class="block truncate text-xs text-slate-500">
                  {{ document.file.scheme.group_name || 'Без группы' }}
                </span>
              </button>
              <button
                type="button"
                class="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                :aria-label="`Удалить ${document.file.scheme.name || 'Без названия'}`"
                @click="deleteDocument(document.id)"
              >
                <Trash2 class="size-4" />
              </button>
            </article>
          </div>

          <div v-else class="grid justify-items-center gap-3 rounded-lg border border-dashed p-5 text-center">
            <p class="text-sm text-slate-500">Создайте первую схему или откройте JSON v2.</p>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
              @click="createDocument"
            >
              <Plus class="size-4" />
              Создать схему
            </button>
          </div>
        </aside>

        <section v-if="activeDocument" class="grid min-w-0 gap-3">
          <section class="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 md:items-end">
            <label class="grid gap-1.5 text-sm font-medium">
              Название схемы
              <input
                data-testid="scheme-name"
                :value="activeDocument.file.scheme.name"
                :aria-invalid="Boolean(identityError)"
                class="h-10 rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-sky-500"
                @input="updateName"
              >
            </label>
            <label class="grid gap-1.5 text-sm font-medium">
              Группа схем
              <input
                :value="activeDocument.file.scheme.group_name ?? ''"
                :aria-invalid="Boolean(identityError)"
                class="h-10 rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Например: Театры"
                @input="updateGroupName"
              >
            </label>
            <p v-if="identityError" class="text-sm text-red-700 md:col-span-2">
              {{ identityError }}
            </p>
            <p v-if="exportedAt" class="text-sm text-slate-500 md:col-span-2">
              Экспортировано в {{ exportedAt }}
            </p>
          </section>

          <SeatMapEditor
            :key="activeDocument.id"
            :initial-canvas="activeDocument.file.schema_json.canvas"
            :initial-objects="activeDocument.file.objects"
            :initial-price-groups="activeDocument.file.schema_json.price_groups"
            :external-file-handling="true"
            @save="saveEditorState"
            @export="exportEditorState"
          />
        </section>

        <section
          v-else
          class="grid min-h-72 place-items-center rounded-xl border border-dashed bg-white p-8 text-center shadow-sm"
        >
          <div class="grid max-w-sm justify-items-center gap-3">
            <div class="grid size-12 place-items-center rounded-full bg-sky-50 text-sky-600">
              <Layers3 class="size-6" />
            </div>
            <div>
              <h2 class="font-semibold">Выберите схему для редактирования</h2>
              <p class="mt-1 text-sm text-slate-500">
                Документы не отправляются на сервер и остаются в localStorage браузера.
              </p>
            </div>
          </div>
        </section>
      </section>

      <footer class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        <span>Готовый JSON загружается в админке FPass владельцем платформы.</span>
        <span class="inline-flex items-center gap-1.5">
          <Layers3 class="size-4" />
          Offline · JSON v2
        </span>
      </footer>
    </section>
  </main>
</template>
