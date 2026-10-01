<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import App from './App.vue'
import BuyerSimulationFrame from './buyer/BuyerSimulationFrame.vue'
import BuyerSimulationPage from './buyer/BuyerSimulationPage.vue'
import GalleryPage from './gallery/GalleryPage.vue'
import { parseStudioRoute } from './route'
import SchemeLibraryGate from './schemes/SchemeLibraryGate.vue'

const hash = ref(window.location.hash)
const route = computed(() => parseStudioRoute(hash.value))

function syncHash(): void {
  hash.value = window.location.hash
}

onMounted(() => window.addEventListener('hashchange', syncHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', syncHash))
</script>

<template>
  <BuyerSimulationPage
    v-if="route.view === 'buyer'"
    :key="route.id"
    :document-id="route.id"
  />
  <BuyerSimulationFrame
    v-else-if="route.view === 'buyer-frame'"
    :key="route.id"
    :document-id="route.id"
    :sold-percent="route.sold"
  />
  <SchemeLibraryGate v-else-if="route.view === 'scheme'">
    <App
      :key="route.id"
      :document-id="route.id"
    />
  </SchemeLibraryGate>
  <GalleryPage v-else />
</template>
