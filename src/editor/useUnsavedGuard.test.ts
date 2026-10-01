import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useUnsavedGuard } from './useUnsavedGuard'

function setup(dirtyValue: boolean, saveResult = true) {
  const dirty = ref(dirtyValue)
  const save = vi.fn(async () => saveResult)
  const scope = effectScope()
  const guard = scope.run(() => useUnsavedGuard(dirty, save))!

  return { dirty, save, scope, guard, action: vi.fn() }
}

function beforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('useUnsavedGuard', () => {
  it('leaves immediately when there are no unsaved changes', () => {
    const { guard, action, scope } = setup(false)

    guard.leave(action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(guard.prompting.value).toBe(false)
    scope.stop()
  })

  it('asks before leaving with unsaved changes and stays on cancel', () => {
    const { guard, action, scope } = setup(true)

    guard.leave(action)
    expect(guard.prompting.value).toBe(true)
    expect(action).not.toHaveBeenCalled()

    guard.cancel()
    expect(guard.prompting.value).toBe(false)
    expect(action).not.toHaveBeenCalled()
    scope.stop()
  })

  it('leaves without saving on discard', () => {
    const { guard, action, save, scope } = setup(true)

    guard.leave(action)
    guard.discard()

    expect(action).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
    expect(guard.prompting.value).toBe(false)
    scope.stop()
  })

  it('saves and then leaves', async () => {
    const { guard, action, save, scope } = setup(true)

    guard.leave(action)
    await guard.saveAndLeave()

    expect(save).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(1)
    expect(guard.prompting.value).toBe(false)
    scope.stop()
  })

  it('stays when saving fails', async () => {
    const { guard, action, scope } = setup(true, false)

    guard.leave(action)
    await guard.saveAndLeave()

    expect(action).not.toHaveBeenCalled()
    expect(guard.prompting.value).toBe(false)
    scope.stop()
  })

  it('warns on page unload only while there are unsaved changes', () => {
    const { dirty, scope } = setup(false)

    expect(beforeUnload().defaultPrevented).toBe(false)

    dirty.value = true
    expect(beforeUnload().defaultPrevented).toBe(true)

    scope.stop()
    expect(beforeUnload().defaultPrevented).toBe(false)
  })
})
