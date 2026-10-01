<script setup lang="ts">
import { FileUp, Plus, Search } from '@lucide/vue'
import { computed, ref } from 'vue'

import { schemeHash } from '../route'
import { useSchemeLibrary } from '../schemes/useSchemeLibrary'
import GalleryCard from './GalleryCard.vue'
import GalleryConfirmDialog from './GalleryConfirmDialog.vue'
import GalleryEmptyState from './GalleryEmptyState.vue'
import { useGallery } from './useGallery'

const library = useSchemeLibrary()
const { documents, persistenceError, importError } = library
const { query, groups, isEmpty } = useGallery(documents)
const fileInput = ref<HTMLInputElement | null>(null)
const pendingDeleteId = ref<string | null>(null)

const pendingDeleteName = computed(() => (
  pendingDeleteId.value === null ? null : library.find(pendingDeleteId.value)?.file.scheme.name ?? null
))
const noResults = computed(() => !isEmpty.value && groups.value.length === 0)
const noResultsText = computed(() => `Ничего не найдено по запросу «${query.value.trim()}».`)

function openScheme(id: string): void {
  window.location.hash = schemeHash(id)
}

function createScheme(): void {
  const document = library.create()
  if (document !== null) openScheme(document.id)
}

function chooseFile(): void {
  fileInput.value?.click()
}

async function importSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await library.importFile(file)
}

function confirmDelete(): void {
  if (pendingDeleteId.value !== null) library.remove(pendingDeleteId.value)
  pendingDeleteId.value = null
}
</script>

<template>
  <main class="min-h-dvh bg-slate-50 text-slate-900">
    <header class="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-3">
        <div class="grid size-9 place-items-center rounded-lg bg-sky-500 text-xl font-bold text-white">F</div>
        <div class="mr-auto">
          <h1 class="text-base font-semibold">FPass Scheme Studio</h1>
          <p class="text-sm text-slate-500">Локальная библиотека интерактивных схем · JSON v2</p>
        </div>
        <label v-if="!isEmpty" class="relative block w-72">
          <span class="sr-only">Поиск по названию</span>
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            v-model="query"
            type="search"
            placeholder="Поиск по названию"
            class="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          >
        </label>
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept="application/json,.json"
          @change="importSelected"
        >
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"
          @click="chooseFile"
        >
          <FileUp class="size-4" />
          Открыть JSON
        </button>
        <button
          type="button"
          class="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700"
          @click="createScheme"
        >
          <Plus class="size-4" />
          Создать схему
        </button>
      </div>
    </header>

    <div class="mx-auto grid max-w-[1600px] gap-8 px-6 py-6">
      <div v-if="persistenceError || importError" class="grid gap-2">
        <p
          v-if="persistenceError"
          data-testid="persistence-error"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {{ persistenceError }}
        </p>
        <p v-if="importError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ importError }}
        </p>
      </div>

      <GalleryEmptyState
        v-if="isEmpty"
        @create="createScheme"
        @import="chooseFile"
        @examples="library.loadExamples()"
      />

      <p v-else-if="noResults" class="py-12 text-center text-sm text-slate-500">{{ noResultsText }}</p>

      <section v-for="group in groups" :key="group.name" class="grid gap-3">
        <header class="flex items-baseline gap-2">
          <h2 data-testid="gallery-group-title" class="text-sm font-semibold uppercase tracking-wide text-slate-600">
            {{ group.name }}
          </h2>
          <span class="text-xs text-slate-400">{{ group.cards.length }}</span>
        </header>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          <GalleryCard
            v-for="card in group.cards"
            :key="card.id"
            :card="card"
            @open="openScheme"
            @duplicate="library.duplicate"
            @export="library.exportDocument"
            @remove="pendingDeleteId = $event"
          />
        </div>
      </section>
    </div>

    <GalleryConfirmDialog
      v-if="pendingDeleteName !== null"
      :name="pendingDeleteName"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null"
    />
  </main>
</template>
