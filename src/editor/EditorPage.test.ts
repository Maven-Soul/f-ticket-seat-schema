import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createStudioScheme, loadStudioSchemes, saveStudioSchemes, type StudioSchemeFile } from '../schemes/library'
import { resetSchemeLibrary, useSchemeLibrary } from '../schemes/useSchemeLibrary'
import EditorPage from './EditorPage.vue'

const editorStub = vi.hoisted(() => ({
  mounts: 0,
  saveState: null as unknown[] | null,
  markSaved: vi.fn(),
}))

vi.mock('@fpass/seat-map/studio', async () => {
  const { defineComponent, h } = await vi.importActual<typeof import('vue')>('vue')

  return {
    SeatMapEditor: defineComponent({
      name: 'SeatMapEditor',
      inheritAttrs: false,
      props: {
        initialCanvas: { type: Object, required: true },
        initialObjects: { type: Array, required: true },
        initialPriceGroups: { type: Array, required: true },
        initialDisplay: { type: Object, default: null },
        storageKey: { type: String, default: null },
        externalFileHandling: { type: Boolean, default: false },
        buyerPreviewEnabled: { type: Boolean, default: false },
        mode: { type: String, default: 'editor' },
        panelStorageKey: { type: String, default: null },
        error: { type: String, default: null },
      },
      emits: ['save', 'export', 'buyer-preview', 'update:mode', 'dirty-change'],
      setup(props, { emit, expose, slots }) {
        const instance = ++editorStub.mounts
        expose({
          save: () => editorStub.saveState && emit('save', ...editorStub.saveState),
          markSaved: editorStub.markSaved,
        })

        return () => h('section', { 'data-testid': 'seat-map-editor', 'data-instance': String(instance) }, [
          h('header', slots['header-start']?.()),
          props.error ? h('p', { 'data-testid': 'editor-error' }, props.error) : null,
          props.mode === 'buyer' ? h('div', { 'data-testid': 'buyer-view' }, slots['buyer-view']?.()) : null,
        ])
      },
    }),
  }
})

function studioFile(name = 'Партер'): StudioSchemeFile {
  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme: { name, group_name: 'Театры' },
    schema_json: {
      canvas: { width: 1400, height: 900, background: '#f8fafc' },
      price_groups: [{ key: 'vip', name: 'VIP', color: '#e11d48', price_amount: 500000 }],
      sections: [],
    },
    objects: [{ external_key: 'dancefloor', type: 'dancefloor', label: 'Танцпол', x: 100, y: 200 }],
  }
}

function editorState(file: StudioSchemeFile, display: unknown = null): unknown[] {
  return [file.schema_json.canvas, file.objects, file.schema_json.price_groups, display]
}

class FailingStorage implements Storage {
  writes = 0
  private failed = false

  constructor(private readonly backing: Storage, private readonly failure: 'write' | 'write-once') {}

  get length(): number { return this.backing.length }
  clear(): void { this.backing.clear() }
  getItem(key: string): string | null { return this.backing.getItem(key) }
  key(index: number): string | null { return this.backing.key(index) }
  removeItem(key: string): void { this.backing.removeItem(key) }

  setItem(key: string, value: string): void {
    this.writes += 1
    if (this.failure === 'write' || !this.failed) {
      this.failed = true
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
    this.backing.setItem(key, value)
  }
}

async function mountPage(id: string, attached = false): Promise<VueWrapper> {
  await useSchemeLibrary().ready
  return mount(EditorPage, { props: { documentId: id }, ...(attached ? { attachTo: document.body } : {}) })
}

function editor(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: 'SeatMapEditor' })
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().includes(label))
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

async function emitFromEditor(wrapper: VueWrapper, event: string, ...args: unknown[]): Promise<void> {
  editor(wrapper).vm.$emit(event, ...args)
  await flushPromises()
}

function stubDownloads(): { blob: () => Blob | undefined, createObjectURL: ReturnType<typeof vi.spyOn> } {
  let exported: Blob | undefined
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
    if (value instanceof Blob) exported = value
    return 'blob:studio-export'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  return { blob: () => exported, createObjectURL }
}

describe('EditorPage', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    localStorage.clear()
    resetSchemeLibrary()
    editorStub.mounts = 0
    editorStub.saveState = null
    editorStub.markSaved.mockReset()
    window.location.hash = '#/scheme/current'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetSchemeLibrary()
    window.location.hash = ''
  })

  it('reports an unknown scheme with a link to the gallery', async () => {
    wrapper = await mountPage('missing')

    expect(wrapper.text()).toContain('Схема не найдена')
    expect(wrapper.get('a').attributes('href')).toBe('#/')
    expect(editor(wrapper).exists()).toBe(false)
  })

  it('gives the full-screen editor the stored document without legacy capacity', async () => {
    const document = createStudioScheme('Партер')
    document.file = { ...studioFile(), schema_json: { ...studioFile().schema_json, display: { section_contents: 'after_zoom', sector_price_labels: true } } }
    document.file.objects = [{ ...document.file.objects[0], capacity: 80 }]
    saveStudioSchemes([document])
    wrapper = await mountPage(document.id)

    expect(wrapper.get('main').classes()).toContain('h-dvh')
    expect(editor(wrapper).props()).toMatchObject({
      initialCanvas: document.file.schema_json.canvas,
      initialObjects: studioFile().objects,
      initialPriceGroups: document.file.schema_json.price_groups,
      initialDisplay: { section_contents: 'after_zoom', sector_price_labels: true },
      panelStorageKey: 'fpass-scheme-studio:editor-panels',
      buyerPreviewEnabled: true,
      externalFileHandling: true,
      mode: 'editor',
    })
  })

  it('renames on blur and Enter with a canonical identity and offers existing groups', async () => {
    const document = createStudioScheme('Партер')
    const other = createStudioScheme('Клуб')
    other.file.scheme.group_name = 'Клубы'
    saveStudioSchemes([document, other])
    wrapper = await mountPage(document.id, true)
    const name = wrapper.get('[data-testid="scheme-name"]')
    const group = wrapper.get('[data-testid="scheme-group"]')

    await name.setValue('  Новый партер  ')
    await flushPromises()
    expect(loadStudioSchemes()[0].file.scheme.name).toBe('Партер')

    await name.trigger('blur')
    await flushPromises()
    expect(loadStudioSchemes()[0].file.scheme).toEqual({ name: 'Новый партер', group_name: null })
    expect((name.element as HTMLInputElement).value).toBe('Новый партер')

    ;(group.element as HTMLInputElement).focus()
    await group.setValue('Театры')
    await group.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(loadStudioSchemes()[0].file.scheme.group_name).toBe('Театры')

    const options = wrapper.findAll(`datalist#${group.attributes('list')} option`)
    expect(options.map(option => option.attributes('value'))).toEqual(['Клубы', 'Театры'])
  })

  it('shows the identity error and keeps the stored document for an empty name', async () => {
    const document = createStudioScheme('Партер')
    saveStudioSchemes([document])
    const downloads = stubDownloads()
    wrapper = await mountPage(document.id)

    await wrapper.get('[data-testid="scheme-name"]').setValue('   ')
    await wrapper.get('[data-testid="scheme-name"]').trigger('blur')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('Название схемы обязательно')
    await emitFromEditor(wrapper, 'export', ...editorState(studioFile()))
    expect(loadStudioSchemes()).toEqual([document])
    expect(downloads.createObjectURL).not.toHaveBeenCalled()
  })

  it('commits a failed rename again before exporting so the export is not stale', async () => {
    const backing = localStorage
    const document = createStudioScheme('Партер')
    saveStudioSchemes([document], backing)
    const failing = new FailingStorage(backing, 'write-once')
    vi.stubGlobal('localStorage', failing)
    const downloads = stubDownloads()
    wrapper = await mountPage(document.id)

    await wrapper.get('[data-testid="scheme-name"]').setValue('Балкон')
    await wrapper.get('[data-testid="scheme-name"]').trigger('blur')
    await flushPromises()

    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('Не удалось сохранить схемы')
    expect(loadStudioSchemes(backing)).toEqual([document])

    await emitFromEditor(wrapper, 'export', ...editorState(studioFile('Балкон')))

    expect(loadStudioSchemes(backing)[0].file.scheme.name).toBe('Балкон')
    expect(downloads.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('saves editor events into the routed document, marks them saved and exports the exact JSON', async () => {
    const first = createStudioScheme('Партер')
    const second = createStudioScheme('Балкон')
    second.file.scheme.group_name = 'Театры'
    saveStudioSchemes([first, second])
    const downloads = stubDownloads()
    wrapper = await mountPage(second.id)
    const file = studioFile('Балкон')
    const display = { section_contents: 'always', sector_price_labels: false }

    await emitFromEditor(wrapper, 'save', ...editorState(file, display))

    expect(loadStudioSchemes()[0].file).toEqual(first.file)
    expect(loadStudioSchemes()[1].file).toEqual({ ...file, schema_json: { ...file.schema_json, display } })
    expect(editorStub.markSaved).toHaveBeenCalledWith(...editorState(file, display))

    await emitFromEditor(wrapper, 'export', ...editorState(file))

    expect(JSON.parse(await downloads.blob()!.text())).toEqual(file)
    expect(Object.hasOwn(loadStudioSchemes()[1].file.schema_json, 'display')).toBe(false)
  })

  it('keeps the durable document and does not export after a failed write', async () => {
    const backing = localStorage
    const document = createStudioScheme('Партер')
    saveStudioSchemes([document], backing)
    vi.stubGlobal('localStorage', new FailingStorage(backing, 'write'))
    const downloads = stubDownloads()
    wrapper = await mountPage(document.id)

    await emitFromEditor(wrapper, 'export', ...editorState(studioFile()))

    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('Не удалось сохранить схемы')
    expect(loadStudioSchemes(backing)).toEqual([document])
    expect(downloads.createObjectURL).not.toHaveBeenCalled()
    expect(editorStub.markSaved).not.toHaveBeenCalled()
  })

  it('switches to the buyer mode in place with a fresh snapshot and keeps the editor instance', async () => {
    const document = createStudioScheme('Партер')
    saveStudioSchemes([document])
    const open = vi.fn()
    vi.stubGlobal('open', open)
    wrapper = await mountPage(document.id)
    const instance = wrapper.get('[data-testid="seat-map-editor"]').attributes('data-instance')
    const file = studioFile()

    await emitFromEditor(wrapper, 'buyer-preview', ...editorState(file))
    await emitFromEditor(wrapper, 'update:mode', 'buyer')

    expect(JSON.parse(localStorage.getItem(`fpass-scheme-studio:buyer-preview:${document.id}`)!)).toEqual({
      name: 'Партер',
      canvas: file.schema_json.canvas,
      objects: file.objects,
      priceGroups: file.schema_json.price_groups,
      display: null,
      createdAt: expect.any(String),
    })
    expect(wrapper.get('[data-testid="buyer-view"] iframe').attributes('src')).toContain(`#/buyer-frame/${document.id}?sold=0`)

    await button(wrapper, 'Открыть в отдельной вкладке').trigger('click')
    expect(open).toHaveBeenCalledWith(`${window.location.href.split('#')[0]}#/buyer/${document.id}`, '_blank')

    await emitFromEditor(wrapper, 'update:mode', 'editor')
    expect(wrapper.find('[data-testid="buyer-view"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="seat-map-editor"]').attributes('data-instance')).toBe(instance)
  })

  it('reports a buyer snapshot that cannot be stored', async () => {
    const backing = localStorage
    const document = createStudioScheme('Партер')
    saveStudioSchemes([document], backing)
    vi.stubGlobal('localStorage', new FailingStorage(backing, 'write'))
    wrapper = await mountPage(document.id)

    await emitFromEditor(wrapper, 'buyer-preview', ...editorState(studioFile()))

    expect(wrapper.get('[data-testid="editor-error"]').text()).toContain('предпросмотр покупателя')
  })

  describe('leaving to the gallery', () => {
    async function mountDirty(): Promise<VueWrapper> {
      const document = createStudioScheme('Партер')
      saveStudioSchemes([document])
      const page = await mountPage(document.id)
      await emitFromEditor(page, 'dirty-change', true)
      await page.get('[data-testid="back-to-gallery"]').trigger('click')
      return page
    }

    it('leaves at once without unsaved changes', async () => {
      const document = createStudioScheme('Партер')
      saveStudioSchemes([document])
      wrapper = await mountPage(document.id)

      await wrapper.get('[data-testid="back-to-gallery"]').trigger('click')

      expect(window.location.hash).toBe('#/')
      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    })

    it('asks first and stays on «Отмена»', async () => {
      wrapper = await mountDirty()

      expect(wrapper.get('[role="alertdialog"]').text()).toContain('Сохранить')
      await button(wrapper, 'Отмена').trigger('click')

      expect(window.location.hash).toBe('#/scheme/current')
      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    })

    it('leaves without saving on «Не сохранять»', async () => {
      wrapper = await mountDirty()

      await button(wrapper, 'Не сохранять').trigger('click')

      expect(window.location.hash).toBe('#/')
      expect(loadStudioSchemes()[0].file.objects).toEqual([])
    })

    it('saves through the editor and leaves on «Сохранить»', async () => {
      editorStub.saveState = editorState(studioFile())
      wrapper = await mountDirty()

      await button(wrapper, 'Сохранить').trigger('click')
      await flushPromises()

      expect(loadStudioSchemes()[0].file.objects).toEqual(studioFile().objects)
      expect(window.location.hash).toBe('#/')
    })

    it('stays when the editor refuses to save', async () => {
      wrapper = await mountDirty()

      await button(wrapper, 'Сохранить').trigger('click')
      await flushPromises()

      expect(window.location.hash).toBe('#/scheme/current')
    })
  })
})
