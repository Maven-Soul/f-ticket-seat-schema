<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { shallowRef, watch } from 'vue'

import BuyerDeviceStage from '../buyer/BuyerDeviceStage.vue'
import { loadBuyerPreviewSnapshot } from '../buyer/snapshot'
import { buyerPageHash, studioUrl } from '../route'

const props = defineProps<{
  documentId: string
  snapshotVersion: number
}>()

const snapshot = shallowRef(loadBuyerPreviewSnapshot(props.documentId))

watch(() => props.snapshotVersion, () => {
  snapshot.value = loadBuyerPreviewSnapshot(props.documentId)
})

function openStandalone(): void {
  window.open(studioUrl(buyerPageHash(props.documentId)), '_blank')
}
</script>

<template>
  <BuyerDeviceStage :document-id="documentId" :snapshot="snapshot" :reload-token="snapshotVersion">
    <template #actions>
      <button
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-sm font-medium hover:bg-slate-50"
        @click="openStandalone"
      >
        <ExternalLink class="size-4" />
        Открыть в отдельной вкладке
      </button>
    </template>
  </BuyerDeviceStage>
</template>
