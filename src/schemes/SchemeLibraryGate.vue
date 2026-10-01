<script setup lang="ts">
import { useSchemeLibrary } from './useSchemeLibrary'

const { loading } = useSchemeLibrary()
</script>

<template>
  <p
    v-if="loading"
    data-testid="library-loading"
    role="status"
    class="py-12 text-center text-sm text-slate-500"
  >
    Загрузка схем…
  </p>
  <slot v-else />
</template>
