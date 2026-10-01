import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SCHEME_NAMES } from '../examples/exampleSchemes'
import { createStudioScheme, loadStudioSchemes, saveStudioSchemes, type StoredStudioScheme } from '../schemes/library'
import { resetSchemeLibrary } from '../schemes/useSchemeLibrary'
import GalleryPage from './GalleryPage.vue'

function stored(name: string, groupName: string | null): StoredStudioScheme {
  const document = createStudioScheme(name)
  return { ...document, file: { ...document.file, scheme: { name, group_name: groupName } } }
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().trim() === label)
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

function cardNames(wrapper: VueWrapper): string[] {
  return wrapper.findAll('[data-testid="scheme-card-name"]').map(name => name.text())
}

async function mountGallery(): Promise<VueWrapper> {
  const wrapper = mount(GalleryPage)
  await flushPromises()
  return wrapper
}

async function openMenu(wrapper: VueWrapper, name: string): Promise<void> {
  await wrapper.get(`[aria-label="Действия со схемой «${name}»"]`).trigger('click')
}

describe('GalleryPage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSchemeLibrary()
    window.location.hash = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetSchemeLibrary()
    window.location.hash = ''
  })

  it('shows a loading state until the library is ready', async () => {
    saveStudioSchemes([stored('Партер', 'Театры')])
    const wrapper = mount(GalleryPage)

    expect(wrapper.get('[data-testid="library-loading"]').text()).toBe('Загрузка схем…')
    expect(wrapper.text()).not.toContain('Загрузить примеры')

    await flushPromises()

    expect(wrapper.find('[data-testid="library-loading"]').exists()).toBe(false)
    expect(cardNames(wrapper)).toEqual(['Партер'])
  })

  it('renders cards grouped by scheme group with «Без группы» last', async () => {
    saveStudioSchemes([stored('Черновик', null), stored('Партер', 'Театры'), stored('Клуб', 'Клубы')])
    const wrapper = await mountGallery()

    expect(wrapper.findAll('[data-testid="gallery-group-title"]').map(title => title.text())).toEqual(['Клубы', 'Театры', 'Без группы'])
    expect(cardNames(wrapper)).toEqual(['Клуб', 'Партер', 'Черновик'])
    expect(wrapper.text()).toContain('0 мест')
  })

  it('filters cards by the search query', async () => {
    saveStudioSchemes([stored('Партер', 'Театры'), stored('Клуб', 'Клубы')])
    const wrapper = await mountGallery()

    await wrapper.get('input[type="search"]').setValue('клу')

    expect(cardNames(wrapper)).toEqual(['Клуб'])
  })

  it('opens a scheme by setting its hash on card click', async () => {
    const document = stored('Партер', 'Театры')
    saveStudioSchemes([document])
    const wrapper = await mountGallery()

    await wrapper.get('[data-testid="scheme-card-link"]').trigger('click')

    expect(window.location.hash).toBe(`#/scheme/${document.id}`)
  })

  it('creates a scheme and navigates to it', async () => {
    const wrapper = await mountGallery()

    await button(wrapper, 'Создать схему').trigger('click')
    await flushPromises()

    const [created] = loadStudioSchemes()
    expect(window.location.hash).toBe(`#/scheme/${created.id}`)
  })

  it('duplicates a scheme from the card menu', async () => {
    saveStudioSchemes([stored('Партер', 'Театры')])
    const wrapper = await mountGallery()

    await openMenu(wrapper, 'Партер')
    await button(wrapper, 'Дублировать').trigger('click')
    await flushPromises()

    expect(cardNames(wrapper).sort()).toEqual(['Партер', 'Партер (копия)'])
  })

  it('deletes a scheme only after confirmation', async () => {
    saveStudioSchemes([stored('Партер', 'Театры'), stored('Балкон', 'Театры')])
    const wrapper = await mountGallery()

    await openMenu(wrapper, 'Партер')
    await button(wrapper, 'Удалить').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Удалить схему «Партер»?')
    await button(wrapper, 'Отмена').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(loadStudioSchemes()).toHaveLength(2)

    await openMenu(wrapper, 'Партер')
    await button(wrapper, 'Удалить').trigger('click')
    await flushPromises()
    await wrapper.get('[role="alertdialog"] [data-testid="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(loadStudioSchemes().map(document => document.file.scheme.name)).toEqual(['Балкон'])
    expect(cardNames(wrapper)).toEqual(['Балкон'])
  })

  it('exports a scheme from the card menu', async () => {
    saveStudioSchemes([stored('Партер', 'Театры')])
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const wrapper = await mountGallery()

    await openMenu(wrapper, 'Партер')
    await button(wrapper, 'Экспорт JSON').trigger('click')

    expect(click).toHaveBeenCalledTimes(1)
  })

  it('imports a JSON file into the gallery', async () => {
    const wrapper = await mountGallery()
    const input = wrapper.get('input[type="file"]')
    const file = stored('Импорт', 'Клубы').file
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([JSON.stringify(file)], 'scheme.json', { type: 'application/json' })],
    })

    await input.trigger('change')
    await flushPromises()

    expect(cardNames(wrapper)).toEqual(['Импорт'])
  })

  it('offers examples in the empty state', async () => {
    const wrapper = await mountGallery()

    expect(wrapper.text()).toContain('Открыть JSON')
    await button(wrapper, 'Загрузить примеры').trigger('click')
    await flushPromises()

    expect(cardNames(wrapper)).toHaveLength(EXAMPLE_SCHEME_NAMES.length)
    expect(wrapper.findAll('[data-testid="gallery-group-title"]').map(title => title.text())).toEqual(['Примеры'])
  })
})
