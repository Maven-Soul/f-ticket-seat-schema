import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'

export interface UnsavedGuard {
  prompting: Readonly<Ref<boolean>>
  leave(action: () => void): void
  cancel(): void
  discard(): void
  saveAndLeave(): Promise<void>
}

export function useUnsavedGuard(dirty: Readonly<Ref<boolean>>, save: () => Promise<boolean>): UnsavedGuard {
  const pendingAction = shallowRef<(() => void) | null>(null)
  const prompting = computed(() => pendingAction.value !== null)

  function takePending(): (() => void) | null {
    const action = pendingAction.value
    pendingAction.value = null
    return action
  }

  function leave(action: () => void): void {
    if (dirty.value) {
      pendingAction.value = action
      return
    }

    action()
  }

  function cancel(): void {
    pendingAction.value = null
  }

  function discard(): void {
    takePending()?.()
  }

  async function saveAndLeave(): Promise<void> {
    const action = takePending()
    if (action !== null && await save()) {
      action()
    }
  }

  function warnOnUnload(event: BeforeUnloadEvent): void {
    if (dirty.value) {
      event.preventDefault()
    }
  }

  window.addEventListener('beforeunload', warnOnUnload)
  onScopeDispose(() => window.removeEventListener('beforeunload', warnOnUnload))

  return { prompting, leave, cancel, discard, saveAndLeave }
}
