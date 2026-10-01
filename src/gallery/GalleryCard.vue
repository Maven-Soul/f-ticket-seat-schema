<script setup lang="ts">
import { Copy, Download, Ellipsis, Trash2 } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import { schemeHash } from '../route'
import SchemeThumbnail from './SchemeThumbnail.vue'
import type { GalleryCard } from './useGallery'

const props = defineProps<{
  card: GalleryCard
}>()

const emit = defineEmits<{
  open: [id: string]
  duplicate: [id: string]
  export: [id: string]
  remove: [id: string]
}>()

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
const href = computed(() => schemeHash(props.card.id))
const menuLabel = computed(() => `Действия со схемой «${props.card.name}»`)

function closeOnOutside(event: PointerEvent): void {
  if (!menuRoot.value?.contains(event.target as Node)) closeMenu()
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu()
}

function closeMenu(): void {
  menuOpen.value = false
  window.removeEventListener('pointerdown', closeOnOutside)
  window.removeEventListener('keydown', closeOnEscape)
}

function toggleMenu(): void {
  if (menuOpen.value) {
    closeMenu()
    return
  }

  menuOpen.value = true
  window.addEventListener('pointerdown', closeOnOutside)
  window.addEventListener('keydown', closeOnEscape)
}

function choose(action: 'duplicate' | 'export' | 'remove'): void {
  closeMenu()
  if (action === 'duplicate') emit('duplicate', props.card.id)
  else if (action === 'export') emit('export', props.card.id)
  else emit('remove', props.card.id)
}

onBeforeUnmount(closeMenu)
</script>

<template>
  <article
    data-testid="scheme-card"
    class="relative rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
  >
    <a
      data-testid="scheme-card-link"
      :href="href"
      class="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      @click.prevent="emit('open', card.id)"
    >
      <div class="overflow-hidden rounded-t-xl border-b bg-slate-100">
        <SchemeThumbnail :file="card.file" :cache-key="card.cacheKey" />
      </div>
      <div class="grid gap-0.5 py-2.5 pl-3 pr-12">
        <h3 data-testid="scheme-card-name" class="truncate text-sm font-semibold text-slate-900">
          {{ card.name }}
        </h3>
        <p class="truncate text-xs text-slate-500">{{ card.groupName }}</p>
        <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <span class="font-medium text-slate-700">{{ card.seatsLabel }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ card.updatedLabel }}</span>
        </p>
      </div>
    </a>

    <div ref="menuRoot" class="absolute bottom-3 right-2">
      <button
        type="button"
        class="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        :aria-label="menuLabel"
        aria-haspopup="menu"
        :aria-expanded="menuOpen"
        @click="toggleMenu"
      >
        <Ellipsis class="size-4" />
      </button>
      <div
        v-if="menuOpen"
        role="menu"
        class="absolute bottom-full right-0 z-20 mb-1 grid w-44 gap-0.5 rounded-lg border bg-white p-1 text-sm shadow-lg"
      >
        <button type="button" role="menuitem" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100" @click="choose('duplicate')">
          <Copy class="size-4 text-slate-500" />
          Дублировать
        </button>
        <button type="button" role="menuitem" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100" @click="choose('export')">
          <Download class="size-4 text-slate-500" />
          Экспорт JSON
        </button>
        <button type="button" role="menuitem" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-red-600 hover:bg-red-50" @click="choose('remove')">
          <Trash2 class="size-4" />
          Удалить
        </button>
      </div>
    </div>
  </article>
</template>
