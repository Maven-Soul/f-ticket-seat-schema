<script setup lang="ts">
import { ArrowLeft, FileUp, Layers3, Plus, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { SeatMapEditor } from '@fpass/seat-map/studio'
import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'
import {
  canonicalizeStudioSchemeIdentity,
  STUDIO_SCHEME_IDENTITY_ERROR,
  type StoredStudioScheme,
} from './schemes/library'
import { useSchemeLibrary } from './schemes/useSchemeLibrary'
import { saveBuyerPreviewSnapshot } from './buyer/snapshot'
import { buyerPageHash, GALLERY_HASH, schemeHash, studioUrl } from './route'

const props = defineProps<{
  documentId?: string
}>()

const BUYER_PREVIEW_ERROR = 'Не удалось подготовить предпросмотр покупателя в локальном хранилище. Повторите действие.'

const library = useSchemeLibrary()
const { documents, persistenceError, importError } = library
const fileInput = ref<HTMLInputElement | null>(null)
const identityError = ref('')
const buyerPreviewError = ref('')
const activeId = ref<string | null>(props.documentId ?? documents.value[0]?.id ?? null)
const exportedAt = ref<string | null>(null)
const visibleError = computed(() => buyerPreviewError.value || persistenceError.value)

const activeDocument = computed(() => (
  activeId.value === null ? null : library.find(activeId.value)
))
const nameDraft = ref(activeDocument.value?.file.scheme.name ?? '')
const groupNameDraft = ref(activeDocument.value?.file.scheme.group_name ?? '')
const identityDraftPending = ref(false)

watch(activeId, (id) => {
  if (id !== null) {
    history.replaceState(history.state, '', schemeHash(id))
  }
})

function resetIdentityDraft(document = activeDocument.value): void {
  nameDraft.value = document?.file.scheme.name ?? ''
  groupNameDraft.value = document?.file.scheme.group_name ?? ''
  identityDraftPending.value = false
  identityError.value = ''
}

function activate(document: StoredStudioScheme | null): void {
  activeId.value = document?.id ?? null
  importError.value = ''
  resetIdentityDraft(document)
  exportedAt.value = null
}

async function createDocument(): Promise<void> {
  const document = await library.create()
  if (document !== null) {
    activate(document)
  }
}

function selectDocument(id: string): void {
  activate(library.find(id))
}

function draftUnchanged(id: string, name: string, groupName: string): boolean {
  return activeId.value === id && nameDraft.value === name && groupNameDraft.value === groupName
}

async function persistIdentityDraft(): Promise<void> {
  identityDraftPending.value = true
  const name = nameDraft.value
  const groupName = groupNameDraft.value
  try {
    canonicalizeStudioSchemeIdentity(name, groupName)
  } catch {
    identityError.value = STUDIO_SCHEME_IDENTITY_ERROR
    return
  }

  const id = activeId.value
  if (id !== null && await library.rename(id, name, groupName) && draftUnchanged(id, name, groupName)) {
    resetIdentityDraft(library.find(id))
  }
}

function updateName(event: Event): void {
  nameDraft.value = (event.target as HTMLInputElement).value
  void persistIdentityDraft()
}

function updateGroupName(event: Event): void {
  groupNameDraft.value = (event.target as HTMLInputElement).value
  void persistIdentityDraft()
}

function updateEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  display: SeatMapDisplaySettings | null,
): Promise<StoredStudioScheme | null> {
  if (identityDraftPending.value || activeId.value === null) {
    return Promise.resolve(null)
  }

  return library.saveEditorState(activeId.value, canvas, objects, priceGroups, display)
}

function saveEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  display: SeatMapDisplaySettings | null,
): void {
  void updateEditorState(canvas, objects, priceGroups, display)
}

async function exportEditorState(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  display: SeatMapDisplaySettings | null,
): Promise<void> {
  const document = await updateEditorState(canvas, objects, priceGroups, display)
  if (document !== null && library.exportDocument(document.id)) {
    exportedAt.value = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

function openBuyerPreview(
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  display: SeatMapDisplaySettings | null,
): void {
  const document = activeDocument.value
  if (document === null) {
    return
  }

  try {
    saveBuyerPreviewSnapshot(document.id, {
      name: document.file.scheme.name,
      canvas,
      objects,
      priceGroups,
      display,
      createdAt: new Date().toISOString(),
    })
  } catch {
    buyerPreviewError.value = BUYER_PREVIEW_ERROR
    return
  }

  buyerPreviewError.value = ''
  window.open(studioUrl(buyerPageHash(document.id)), '_blank')
}

async function importFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  const document = await library.importFile(file)
  if (document !== null) {
    activate(document)
  }
}

async function deleteDocument(id: string): Promise<void> {
  const index = documents.value.findIndex(document => document.id === id)
  if (index < 0) {
    return
  }

  const document = documents.value[index]
  if (!confirm(`Удалить схему «${document.file.scheme.name || 'Без названия'}»?`) || !(await library.remove(id))) {
    return
  }

  if (activeId.value === id) {
    activeId.value = documents.value[Math.min(index, documents.value.length - 1)]?.id ?? null
    resetIdentityDraft()
  }

  importError.value = ''
  exportedAt.value = null
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 p-3 md:p-5">
    <section class="mx-auto grid max-w-[1800px] gap-3">
      <header class="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <a
          :href="GALLERY_HASH"
          class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
        >
          <ArrowLeft class="size-4" />
          Все схемы
        </a>
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
        v-if="visibleError"
        data-testid="persistence-error"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ visibleError }}
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
                :value="nameDraft"
                :aria-invalid="Boolean(identityError)"
                class="h-10 rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-sky-500"
                @input="updateName"
              >
            </label>
            <label class="grid gap-1.5 text-sm font-medium">
              Группа схем
              <input
                :value="groupNameDraft"
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
            :initial-display="activeDocument.file.schema_json.display ?? null"
            :external-file-handling="true"
            :buyer-preview-enabled="true"
            @save="saveEditorState"
            @export="exportEditorState"
            @buyer-preview="openBuyerPreview"
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
