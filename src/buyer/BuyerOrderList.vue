<script setup lang="ts">
import { Minus, Plus } from '@lucide/vue'

import type { BuyerOrderLine } from './order'
import { formatRubles } from './order'

defineProps<{
  lines: BuyerOrderLine[]
}>()

defineEmits<{
  increase: [key: string]
  decrease: [key: string]
}>()
</script>

<template>
  <ul v-if="lines.length > 0" class="grid gap-2" aria-label="Выбранные места">
    <li
      v-for="line in lines"
      :key="line.key"
      class="flex items-baseline justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-xs"
    >
      <span class="min-w-0 text-slate-800">{{ line.label }}<template v-if="line.adjustable"> × {{ line.quantity }}</template></span>
      <span v-if="line.adjustable" class="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          :data-testid="`buyer-order-decrease-${line.key}`"
          class="grid size-6 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          :aria-label="`Убрать билет: ${line.label}`"
          @click="$emit('decrease', line.key)"
        >
          <Minus class="size-3.5" />
        </button>
        <button
          type="button"
          :data-testid="`buyer-order-increase-${line.key}`"
          class="grid size-6 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          :aria-label="`Добавить билет: ${line.label}`"
          @click="$emit('increase', line.key)"
        >
          <Plus class="size-3.5" />
        </button>
      </span>
      <span class="sr-only"> — </span>
      <span class="shrink-0 font-semibold tabular-nums text-slate-900">{{ formatRubles(line.amount) }}</span>
    </li>
  </ul>
  <p v-else class="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
    Выберите места на схеме — до 10 билетов в заказе.
  </p>
</template>
