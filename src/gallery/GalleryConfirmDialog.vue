<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  name: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const cancelButton = ref<HTMLButtonElement | null>(null)
const title = computed(() => `Удалить схему «${props.name}»?`)

function cancelOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => {
  cancelButton.value?.focus()
  window.addEventListener('keydown', cancelOnEscape)
})
onBeforeUnmount(() => window.removeEventListener('keydown', cancelOnEscape))
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" @click.self="emit('cancel')">
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="gallery-confirm-title"
      aria-describedby="gallery-confirm-description"
      class="grid w-full max-w-sm gap-4 rounded-xl border bg-white p-5 shadow-xl"
    >
      <div class="grid gap-1.5">
        <h2 id="gallery-confirm-title" class="text-base font-semibold text-slate-900">{{ title }}</h2>
        <p id="gallery-confirm-description" class="text-sm text-slate-500">
          Схема хранится только в этом браузере — восстановить её не получится.
        </p>
      </div>
      <div class="flex justify-end gap-2">
        <button
          ref="cancelButton"
          type="button"
          class="h-9 rounded-md border px-3 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          @click="emit('cancel')"
        >
          Отмена
        </button>
        <button
          type="button"
          data-testid="confirm-delete"
          class="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          @click="emit('confirm')"
        >
          Удалить
        </button>
      </div>
    </section>
  </div>
</template>
