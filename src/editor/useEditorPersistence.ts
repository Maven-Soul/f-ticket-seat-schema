import type { SeatMapPricingGroupOption } from '@fpass/seat-map/pricing'
import type { SeatMapCanvasSize, SeatMapDisplaySettings, SeatMapObject } from '@fpass/seat-map/schema'
import { ref, type Ref } from 'vue'

import { saveBuyerPreviewSnapshot } from '../buyer/snapshot'
import type { StoredStudioScheme } from '../schemes/library'
import { useSchemeLibrary } from '../schemes/useSchemeLibrary'

export type EditorState = [
  canvas: SeatMapCanvasSize,
  objects: SeatMapObject[],
  priceGroups: SeatMapPricingGroupOption[],
  display: SeatMapDisplaySettings | null,
]

export interface EditorHandle {
  save(): void
  markSaved(...state: EditorState): void
}

export interface EditorPersistence {
  buyerPreviewError: Ref<string>
  snapshotVersion: Ref<number>
  save(...state: EditorState): void
  exportScheme(...state: EditorState): Promise<void>
  storeBuyerPreview(...state: EditorState): void
  requestSave(): Promise<boolean>
}

const BUYER_PREVIEW_ERROR = 'Не удалось подготовить предпросмотр покупателя в локальном хранилище. Повторите действие.'

export function useEditorPersistence(
  documentId: string,
  commitIdentity: () => Promise<boolean>,
  editor: Readonly<Ref<EditorHandle | null>>,
): EditorPersistence {
  const library = useSchemeLibrary()
  const buyerPreviewError = ref('')
  const snapshotVersion = ref(0)
  let lastSave: Promise<boolean> | null = null

  async function persist(state: EditorState): Promise<StoredStudioScheme | null> {
    if (!(await commitIdentity())) {
      return null
    }

    const saved = await library.saveEditorState(documentId, ...state)
    if (saved !== null) {
      editor.value?.markSaved(...state)
    }

    return saved
  }

  function save(...state: EditorState): void {
    lastSave = persist(state).then(saved => saved !== null)
  }

  async function exportScheme(...state: EditorState): Promise<void> {
    const saved = await persist(state)
    if (saved !== null) {
      library.exportDocument(saved.id)
    }
  }

  function storeBuyerPreview(...[canvas, objects, priceGroups, display]: EditorState): void {
    const document = library.find(documentId)
    if (document === null) {
      return
    }

    try {
      saveBuyerPreviewSnapshot(documentId, {
        name: document.file.scheme.name,
        canvas,
        objects,
        priceGroups,
        display,
        createdAt: new Date().toISOString(),
      })
    } catch {
      buyerPreviewError.value = BUYER_PREVIEW_ERROR
      return
    }

    buyerPreviewError.value = ''
    snapshotVersion.value += 1
  }

  function takeLastSave(): Promise<boolean> {
    const result = lastSave ?? Promise.resolve(false)
    lastSave = null
    return result
  }

  function requestSave(): Promise<boolean> {
    lastSave = null
    editor.value?.save()
    return takeLastSave()
  }

  return { buyerPreviewError, snapshotVersion, save, exportScheme, storeBuyerPreview, requestSave }
}
