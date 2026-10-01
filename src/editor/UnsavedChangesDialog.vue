<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{
  save: []
  discard: []
  cancel: []
}>()

const saveButton = ref<HTMLButtonElement | null>(null)

function cancelOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => {
  saveButton.value?.focus()
  window.addEventListener('keydown', cancelOnEscape)
})
onBeforeUnmount(() => window.removeEventListener('keydown', cancelOnEscape))
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" @click.self="emit('cancel')">
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-description"
      class="grid w-full max-w-md gap-4 rounded-xl border bg-white p-5 shadow-xl"
    >
      <div class="grid gap-1.5">
        <h2 id="unsaved-changes-title" class="text-base font-semibold text-slate-900">Сохранить изменения в схеме?</h2>
        <p id="unsaved-changes-description" class="text-sm text-slate-500">
          Если не сохранить, изменения после последнего сохранения пропадут.
        </p>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="h-9 rounded-md border px-3 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          @click="emit('cancel')"
        >
          Отмена
        </button>
        <button
          type="button"
          class="h-9 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          @click="emit('discard')"
        >
          Не сохранять
        </button>
        <button
          ref="saveButton"
          type="button"
          class="h-9 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          @click="emit('save')"
        >
          Сохранить
        </button>
      </div>
    </section>
  </div>
</template>
