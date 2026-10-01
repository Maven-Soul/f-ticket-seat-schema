import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { canonicalizeStudioSchemeIdentity, STUDIO_SCHEME_IDENTITY_ERROR } from '../schemes/library'
import { useSchemeLibrary } from '../schemes/useSchemeLibrary'

export interface SchemeIdentity {
  nameDraft: Ref<string>
  groupDraft: Ref<string>
  error: Ref<string>
  groups: ComputedRef<string[]>
  commit(): Promise<boolean>
}

export function useSchemeIdentity(documentId: string): SchemeIdentity {
  const library = useSchemeLibrary()
  const stored = computed(() => library.find(documentId)?.file.scheme ?? null)
  const nameDraft = ref(stored.value?.name ?? '')
  const groupDraft = ref(stored.value?.group_name ?? '')
  const error = ref('')
  const groups = computed(() => [...new Set(
    library.documents.value
      .map(document => document.file.scheme.group_name)
      .filter((name): name is string => name !== null),
  )].sort((left, right) => left.localeCompare(right, 'ru')))

  function draftsAre(name: string, groupName: string): boolean {
    return nameDraft.value === name && groupDraft.value === groupName
  }

  async function commit(): Promise<boolean> {
    const name = nameDraft.value
    const groupName = groupDraft.value
    let scheme: { name: string, group_name: string | null }
    try {
      scheme = canonicalizeStudioSchemeIdentity(name, groupName)
    } catch {
      error.value = STUDIO_SCHEME_IDENTITY_ERROR
      return false
    }

    error.value = ''
    const current = stored.value
    const unchanged = current?.name === scheme.name && current.group_name === scheme.group_name
    if (!unchanged && !(await library.rename(documentId, name, groupName))) {
      return false
    }

    if (draftsAre(name, groupName)) {
      nameDraft.value = scheme.name
      groupDraft.value = scheme.group_name ?? ''
    }

    return true
  }

  return { nameDraft, groupDraft, error, groups, commit }
}
