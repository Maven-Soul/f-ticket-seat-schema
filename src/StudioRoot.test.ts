import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetSchemeLibrary } from './schemes/useSchemeLibrary'
import StudioRoot from './StudioRoot.vue'

vi.mock('./editor/EditorPage.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  return {
    default: defineComponent({
      name: 'EditorPage',
      props: { documentId: { type: String, default: null } },
      setup: props => () => h('div', { 'data-testid': 'editor-page' }, props.documentId ?? ''),
    }),
  }
})

vi.mock('./gallery/GalleryPage.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  return { default: defineComponent({ name: 'GalleryPage', setup: () => () => h('div', { 'data-testid': 'gallery' }) }) }
})

vi.mock('./buyer/BuyerSimulationPage.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  return {
    default: defineComponent({
      name: 'BuyerSimulationPage',
      props: { documentId: { type: String, required: true } },
      setup: props => () => h('div', { 'data-testid': 'buyer-page' }, props.documentId),
    }),
  }
})

vi.mock('./buyer/BuyerSimulationFrame.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  return {
    default: defineComponent({
      name: 'BuyerSimulationFrame',
      props: { documentId: { type: String, required: true }, soldPercent: { type: Number, required: true } },
      setup: props => () => h('div', { 'data-testid': 'buyer-frame' }, `${props.documentId}:${props.soldPercent}`),
    }),
  }
})

async function navigate(hash: string): Promise<void> {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  await flushPromises()
}

describe('StudioRoot hash routing', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSchemeLibrary()
  })

  afterEach(() => {
    window.location.hash = ''
    resetSchemeLibrary()
  })

  it('shows the library loading state before the scheme editor', async () => {
    window.location.hash = '#/scheme/doc-1'
    const wrapper = mount(StudioRoot)

    expect(wrapper.find('[data-testid="library-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="editor-page"]').exists()).toBe(false)

    await flushPromises()

    expect(wrapper.find('[data-testid="library-loading"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="editor-page"]').text()).toBe('doc-1')
  })

  it('renders the gallery by default', () => {
    window.location.hash = ''
    const wrapper = mount(StudioRoot)

    expect(wrapper.find('[data-testid="gallery"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="editor-page"]').exists()).toBe(false)
  })

  it('renders the scheme editor with the routed id and returns to the gallery', async () => {
    window.location.hash = '#/scheme/doc-1'
    const wrapper = mount(StudioRoot)
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-page"]').text()).toBe('doc-1')

    await navigate('#/')

    expect(wrapper.find('[data-testid="editor-page"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="gallery"]').exists()).toBe(true)
  })

  it('remounts the scheme editor when the hash switches to another scheme', async () => {
    window.location.hash = '#/scheme/doc-1'
    const wrapper = mount(StudioRoot)
    await flushPromises()
    const first = wrapper.findComponent({ name: 'EditorPage' }).vm

    await navigate('#/scheme/doc-2')

    expect(wrapper.get('[data-testid="editor-page"]').text()).toBe('doc-2')
    expect(wrapper.findComponent({ name: 'EditorPage' }).vm).not.toBe(first)
  })

  it('renders the buyer simulation page and frame for their hashes', async () => {
    window.location.hash = '#/buyer/doc-1'
    const wrapper = mount(StudioRoot)

    expect(wrapper.get('[data-testid="buyer-page"]').text()).toBe('doc-1')

    await navigate('#/buyer-frame/doc-1?sold=30')

    expect(wrapper.get('[data-testid="buyer-frame"]').text()).toBe('doc-1:30')
    expect(wrapper.find('[data-testid="buyer-page"]').exists()).toBe(false)
  })

  it('remounts the buyer frame when the hash switches to another scheme', async () => {
    window.location.hash = '#/buyer-frame/doc-1?sold=0'
    const wrapper = mount(StudioRoot)
    const first = wrapper.findComponent({ name: 'BuyerSimulationFrame' }).vm

    await navigate('#/buyer-frame/doc-2?sold=0')

    expect(wrapper.findComponent({ name: 'BuyerSimulationFrame' }).vm).not.toBe(first)
  })
})
