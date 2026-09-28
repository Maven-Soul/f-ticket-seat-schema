import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import StudioRoot from './StudioRoot.vue'

vi.mock('./App.vue', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')
  return { default: defineComponent({ name: 'App', setup: () => () => h('div', { 'data-testid': 'editor-app' }) }) }
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

describe('StudioRoot hash routing', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  it('renders the editor by default', () => {
    window.location.hash = ''
    const wrapper = mount(StudioRoot)

    expect(wrapper.find('[data-testid="editor-app"]').exists()).toBe(true)
  })

  it('renders the buyer simulation page and frame for their hashes', async () => {
    window.location.hash = '#/buyer/doc-1'
    const wrapper = mount(StudioRoot)

    expect(wrapper.get('[data-testid="buyer-page"]').text()).toBe('doc-1')

    window.location.hash = '#/buyer-frame/doc-1?sold=30'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    expect(wrapper.get('[data-testid="buyer-frame"]').text()).toBe('doc-1:30')
    expect(wrapper.find('[data-testid="buyer-page"]').exists()).toBe(false)
  })

  it('remounts the buyer frame when the hash switches to another scheme', async () => {
    window.location.hash = '#/buyer-frame/doc-1?sold=0'
    const wrapper = mount(StudioRoot)
    const first = wrapper.findComponent({ name: 'BuyerSimulationFrame' }).vm

    window.location.hash = '#/buyer-frame/doc-2?sold=0'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    expect(wrapper.findComponent({ name: 'BuyerSimulationFrame' }).vm).not.toBe(first)
  })
})
