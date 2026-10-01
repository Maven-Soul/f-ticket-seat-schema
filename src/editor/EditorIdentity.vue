<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed } from 'vue'

import { GALLERY_HASH } from '../route'

const props = defineProps<{
  name: string
  groupName: string
  groups: string[]
  invalid: boolean
}>()

const emit = defineEmits<{
  'update:name': [name: string]
  'update:groupName': [groupName: string]
  commit: []
  back: []
}>()

const GROUP_OPTIONS_ID = 'scheme-group-options'

const fieldClass = computed(() => (props.invalid
  ? 'border-red-300 bg-red-50 focus:border-red-400'
  : 'border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 focus:bg-white'))

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function blurOnEnter(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    (event.target as HTMLInputElement).blur()
  }
}

function goBack(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }

  event.preventDefault()
  emit('back')
}
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <a
      :href="GALLERY_HASH"
      data-testid="back-to-gallery"
      class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      @click="goBack"
    >
      <ArrowLeft class="size-4" />
      Все схемы
    </a>
    <span class="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
    <input
      data-testid="scheme-name"
      aria-label="Название схемы"
      :value="name"
      :aria-invalid="invalid"
      :title="name"
      class="h-8 w-56 min-w-0 truncate rounded-md border px-2 text-sm font-semibold text-slate-900 outline-none transition-colors"
      :class="fieldClass"
      @input="emit('update:name', inputValue($event))"
      @blur="emit('commit')"
      @keydown="blurOnEnter"
    >
    <input
      data-testid="scheme-group"
      aria-label="Группа схем"
      placeholder="Без группы"
      :value="groupName"
      :list="GROUP_OPTIONS_ID"
      :aria-invalid="invalid"
      class="h-8 w-36 min-w-0 rounded-md border px-2 text-sm text-slate-600 outline-none transition-colors placeholder:text-slate-400"
      :class="fieldClass"
      @input="emit('update:groupName', inputValue($event))"
      @blur="emit('commit')"
      @keydown="blurOnEnter"
    >
    <datalist :id="GROUP_OPTIONS_ID">
      <option v-for="group in groups" :key="group" :value="group" />
    </datalist>
  </div>
</template>
