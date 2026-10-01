<script setup lang="ts">
import { FileUp, LayoutTemplate, Plus, Sparkles } from '@lucide/vue'

const emit = defineEmits<{
  create: []
  import: []
  examples: []
}>()
</script>

<template>
  <section class="mx-auto grid max-w-lg justify-items-center gap-5 rounded-xl border border-dashed bg-white px-8 py-12 text-center shadow-sm">
    <div class="grid size-14 place-items-center rounded-2xl bg-sky-50 text-sky-600">
      <LayoutTemplate class="size-7" />
    </div>
    <div class="grid gap-1.5">
      <h2 class="text-lg font-semibold text-slate-900">Здесь пока нет схем</h2>
      <p class="text-sm text-slate-500">
        Создайте схему с нуля, откройте JSON v2 или начните с готовых примеров: клуб, ресторан, театр и арена.
      </p>
    </div>
    <div class="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700"
        @click="emit('create')"
      >
        <Plus class="size-4" />
        Создать схему
      </button>
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
        @click="emit('import')"
      >
        <FileUp class="size-4" />
        Открыть JSON
      </button>
      <button
        type="button"
        class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-slate-50"
        @click="emit('examples')"
      >
        <Sparkles class="size-4" />
        Загрузить примеры
      </button>
    </div>
  </section>
</template>
