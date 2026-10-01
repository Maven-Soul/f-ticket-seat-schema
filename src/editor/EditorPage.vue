<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed, ref } from 'vue'

import { SeatMapEditor } from '@fpass/seat-map/studio'
import { GALLERY_HASH } from '../route'
import { useSchemeLibrary } from '../schemes/useSchemeLibrary'
import BuyerModeView from './BuyerModeView.vue'
import EditorIdentity from './EditorIdentity.vue'
import UnsavedChangesDialog from './UnsavedChangesDialog.vue'
import { useEditorPersistence, type EditorHandle } from './useEditorPersistence'
import { useSchemeIdentity } from './useSchemeIdentity'
import { useUnsavedGuard } from './useUnsavedGuard'

const props = defineProps<{
  documentId: string
}>()

const PANEL_STORAGE_KEY = 'fpass-scheme-studio:editor-panels'

const library = useSchemeLibrary()
const { persistenceError } = library
const editor = ref<EditorHandle | null>(null)
const mode = ref<'editor' | 'buyer'>('editor')
const dirty = ref(false)
const { nameDraft, groupDraft, error: identityError, groups, commit } = useSchemeIdentity(props.documentId)
const { buyerPreviewError, snapshotVersion, save, exportScheme, storeBuyerPreview, requestSave } = useEditorPersistence(
  props.documentId,
  commit,
  editor,
)
const { prompting, leave, cancel, discard, saveAndLeave } = useUnsavedGuard(dirty, requestSave)

const document = computed(() => library.find(props.documentId))
const initialDisplay = computed(() => document.value?.file.schema_json.display ?? null)
const visibleError = computed(() => identityError.value || buyerPreviewError.value || persistenceError.value || null)

function goToGallery(): void {
  window.location.hash = GALLERY_HASH
}

function setDirty(value: boolean): void {
  dirty.value = value
}
</script>

<template>
  <main v-if="document" class="h-dvh overflow-hidden bg-slate-50 text-slate-900">
    <SeatMapEditor
      :key="documentId"
      ref="editor"
      v-model:mode="mode"
      :initial-canvas="document.file.schema_json.canvas"
      :initial-objects="document.file.objects"
      :initial-price-groups="document.file.schema_json.price_groups"
      :initial-display="initialDisplay"
      :panel-storage-key="PANEL_STORAGE_KEY"
      :error="visibleError"
      buyer-preview-enabled
      external-file-handling
      @dirty-change="setDirty"
      @save="save"
      @export="exportScheme"
      @buyer-preview="storeBuyerPreview"
    >
      <template #header-start>
        <EditorIdentity
          v-model:name="nameDraft"
          v-model:group-name="groupDraft"
          :groups="groups"
          :invalid="Boolean(identityError)"
          @commit="commit"
          @back="leave(goToGallery)"
        />
      </template>
      <template #buyer-view>
        <BuyerModeView :document-id="documentId" :snapshot-version="snapshotVersion" />
      </template>
    </SeatMapEditor>

    <UnsavedChangesDialog v-if="prompting" @save="saveAndLeave" @discard="discard" @cancel="cancel" />
  </main>

  <main v-else class="grid h-dvh place-items-center bg-slate-50 p-6 text-center text-slate-900">
    <div class="grid justify-items-center gap-3">
      <h1 class="text-lg font-semibold">Схема не найдена</h1>
      <p class="max-w-sm text-sm text-slate-500">Возможно, она удалена или хранится в другом браузере.</p>
      <a
        :href="GALLERY_HASH"
        class="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"
      >
        <ArrowLeft class="size-4" />
        Все схемы
      </a>
    </div>
  </main>
</template>
