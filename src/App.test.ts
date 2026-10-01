import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import {
  createStudioScheme,
  loadStudioSchemes,
  saveStudioSchemes,
  type StudioSchemeFile,
} from './schemes/library'
import { resetSchemeLibrary, useSchemeLibrary } from './schemes/useSchemeLibrary'

const editorMounts = vi.hoisted(() => ({ count: 0 }))

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
      },
      emits: ['save', 'export', 'buyer-preview'],
      setup() {
        const instance = ++editorMounts.count
        return () => h('div', {
          'data-testid': 'seat-map-editor',
          'data-instance': String(instance),
        })
      },
    }),
  }
})

const FIRST_ID = '00000000-0000-4000-8000-000000000001'
const IMPORTED_ID = '00000000-0000-4000-8000-000000000002'
const FORMAT_ERROR = 'Поддерживается JSON-схема FPass версии 2.'

function studioFile(name = 'Главный зал'): StudioSchemeFile {
  return {
    format: 'fpass-seat-map',
    version: 2,
    scheme: {
      name,
      group_name: 'Театры',
    },
    schema_json: {
      canvas: {
        width: 1400,
        height: 900,
        background: '#f8fafc',
      },
      price_groups: [
        {
          key: 'vip',
          name: 'VIP',
          color: '#e11d48',
          price_amount: 500000,
        },
      ],
      sections: [],
    },
    objects: [
      {
        external_key: 'dancefloor',
        type: 'dancefloor',
        label: 'Танцпол',
        x: 100,
        y: 200,
      },
    ],
  }
}

class FailingStorage implements Storage {
  writes = 0

  private writeFailed = false

  constructor(
    private readonly backing: Storage,
    private readonly failure: 'read' | 'write' | 'write-once',
  ) {}

  get length(): number {
    return this.backing.length
  }

  clear(): void {
    this.backing.clear()
  }

  getItem(key: string): string | null {
    if (this.failure === 'read') {
      throw new DOMException('Storage access denied', 'SecurityError')
    }

    return this.backing.getItem(key)
  }

  key(index: number): string | null {
    return this.backing.key(index)
  }

  removeItem(key: string): void {
    this.backing.removeItem(key)
  }

  setItem(key: string, value: string): void {
    this.writes += 1

    if (
      this.failure === 'write'
      || (this.failure === 'write-once' && !this.writeFailed)
    ) {
      this.writeFailed = true
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }

    this.backing.setItem(key, value)
  }
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().includes(label))
  if (!match) {
    throw new Error(`Button not found: ${label}`)
  }

  return match
}

async function importJson(wrapper: VueWrapper, value: unknown): Promise<void> {
  const input = wrapper.get('input[type="file"]')
  const file = new File([JSON.stringify(value)], 'scheme.json', { type: 'application/json' })

  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  })
  await input.trigger('change')
  await flushPromises()
}

async function mountApp(): Promise<VueWrapper> {
  await useSchemeLibrary().ready
  return mount(App)
}

function editor(wrapper: VueWrapper) {
  const component = wrapper.findComponent({ name: 'SeatMapEditor' })
  if (!component.exists()) {
    throw new Error('SeatMapEditor not found')
  }

  return component
}

function groupNameInput(wrapper: VueWrapper) {
  const input = wrapper.findAll('input').find(candidate => (
    candidate.attributes('placeholder') === 'Например: Театры'
  ))
  if (!input) {
    throw new Error('Group name input not found')
  }

  return input
}

describe('standalone Studio document manager', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSchemeLibrary()
    editorMounts.count = 0
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetSchemeLibrary()
  })

  it('creates, names and selects independent local documents', async () => {
    const wrapper = await mountApp()

    await button(wrapper, 'Создать схему').trigger('click')

    await flushPromises()
    await wrapper.get('[data-testid="scheme-name"]').setValue('Партер')
    await flushPromises()

    await button(wrapper, 'Создать схему').trigger('click')

    await flushPromises()
    await wrapper.get('[data-testid="scheme-name"]').setValue('Балкон')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="studio-document"]')
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.text())).toEqual([
      expect.stringContaining('Партер'),
      expect.stringContaining('Балкон'),
    ])

    await rows[0].find('button').trigger('click')

    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Партер')
    expect(loadStudioSchemes().map(document => document.file.scheme.name)).toEqual(['Партер', 'Балкон'])
    expect(loadStudioSchemes()[0].id).not.toBe(loadStudioSchemes()[1].id)
  })

  it('persists canonical trimmed identity from the Studio inputs', async () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="scheme-name"]').setValue('  Новый партер  ')

    await flushPromises()
    await groupNameInput(wrapper).setValue('  Театры  ')
    await flushPromises()

    expect(loadStudioSchemes()[0].file.scheme).toEqual({
      name: 'Новый партер',
      group_name: 'Театры',
    })
  })

  it('does not persist or export after a group edit while the name draft is invalid', async () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:studio-export')
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="scheme-name"]').setValue('   ')

    await flushPromises()
    await groupNameInput(wrapper).setValue('Новая группа')
    await flushPromises()

    expect(wrapper.text()).toContain('Название схемы обязательно')
    expect(loadStudioSchemes()).toEqual([existing])

    const changed = studioFile('Партер')
    editor(wrapper).vm.$emit(
      'export',
      changed.schema_json.canvas,
      changed.objects,
      changed.schema_json.price_groups,
    )
    await flushPromises()

    expect(loadStudioSchemes()).toEqual([existing])
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('does not export stale identity after a transiently failed rename', async () => {
    const backingStorage = localStorage
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing], backingStorage)
    const failingStorage = new FailingStorage(backingStorage, 'write-once')
    vi.stubGlobal('localStorage', failingStorage)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:studio-export')
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="scheme-name"]').setValue('Балкон')

    await flushPromises()

    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Балкон')
    expect(wrapper.get('[data-testid="persistence-error"]').text()).toContain('Не удалось сохранить схемы')
    expect(loadStudioSchemes(backingStorage)).toEqual([existing])

    const changed = studioFile('Балкон')
    editor(wrapper).vm.$emit(
      'export',
      changed.schema_json.canvas,
      changed.objects,
      changed.schema_json.price_groups,
    )
    await flushPromises()

    expect(failingStorage.writes).toBe(1)
    expect(loadStudioSchemes(backingStorage)).toEqual([existing])
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps creation uncommitted when durable storage rejects the write', async () => {
    const backingStorage = localStorage
    vi.stubGlobal('localStorage', new FailingStorage(backingStorage, 'write'))
    const wrapper = await mountApp()

    await button(wrapper, 'Создать схему').trigger('click')

    await flushPromises()

    expect(wrapper.get('[data-testid="persistence-error"]').text()).toContain('Не удалось сохранить схемы')
    expect(wrapper.findAll('[data-testid="studio-document"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="scheme-name"]').exists()).toBe(false)
    expect(backingStorage.getItem('fpass-scheme-studio:documents:v2')).toBeNull()
  })

  it('keeps the durable editor document authoritative and does not export after a failed write', async () => {
    const backingStorage = localStorage
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing], backingStorage)
    vi.stubGlobal('localStorage', new FailingStorage(backingStorage, 'write'))
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:studio-export')
    const wrapper = await mountApp()
    const changed = studioFile('Партер')

    editor(wrapper).vm.$emit(
      'export',
      changed.schema_json.canvas,
      changed.objects,
      changed.schema_json.price_groups,
    )
    await flushPromises()

    expect(wrapper.get('[data-testid="persistence-error"]').text()).toContain('Не удалось сохранить схемы')
    expect(loadStudioSchemes(backingStorage)).toEqual([existing])
    expect(editor(wrapper).props('initialCanvas')).toEqual(existing.file.schema_json.canvas)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Экспортировано в')
  })

  it('freezes storage-backed actions after an initial read failure', async () => {
    const backingStorage = localStorage
    const existing = createStudioScheme('Не перезаписывать')
    saveStudioSchemes([existing], backingStorage)
    const durableBeforeMount = backingStorage.getItem('fpass-scheme-studio:documents:v2')
    const failingStorage = new FailingStorage(backingStorage, 'read')
    vi.stubGlobal('localStorage', failingStorage)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:studio-export')

    const wrapper = await mountApp()

    expect(wrapper.get('[data-testid="persistence-error"]').text()).toContain('Не удалось загрузить схемы')

    await button(wrapper, 'Создать схему').trigger('click')

    await flushPromises()
    await importJson(wrapper, studioFile('Импорт'))

    expect(failingStorage.writes).toBe(0)
    expect(backingStorage.getItem('fpass-scheme-studio:documents:v2')).toBe(durableBeforeMount)
    expect(wrapper.text()).toContain('Не удалось загрузить схемы')
    expect(wrapper.findAll('[data-testid="studio-document"]')).toHaveLength(0)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('migrates trusted stored capacity and retains the document on the next save', async () => {
    const legacy = createStudioScheme('Старая схема')
    legacy.file.objects = [{
      external_key: 'dancefloor',
      type: 'dancefloor',
      label: 'Танцпол',
      x: 100,
      y: 200,
      capacity: 80,
    }]
    saveStudioSchemes([legacy])

    const wrapper = await mountApp()

    expect(wrapper.findAll('[data-testid="studio-document"]')).toHaveLength(1)
    expect(editor(wrapper).props('initialObjects')).toEqual([{
      external_key: 'dancefloor',
      type: 'dancefloor',
      label: 'Танцпол',
      x: 100,
      y: 200,
    }])

    await wrapper.get('[data-testid="scheme-name"]').setValue('Старая схема сохранена')

    await flushPromises()

    const stored = loadStudioSchemes()
    const persisted = JSON.parse(localStorage.getItem('fpass-scheme-studio:documents:v2') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].file.scheme.name).toBe('Старая схема сохранена')
    expect(stored[0].file.objects).toEqual([{
      external_key: 'dancefloor',
      type: 'dancefloor',
      label: 'Танцпол',
      x: 100,
      y: 200,
    }])
    expect(persisted[0].file.objects).toEqual(stored[0].file.objects)
  })

  it('imports exact JSON v2 under a collision-safe local id and selects it', async () => {
    const existing = createStudioScheme('Существующая схема')
    existing.id = FIRST_ID
    saveStudioSchemes([existing])

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(FIRST_ID)
      .mockReturnValueOnce(IMPORTED_ID)

    const wrapper = await mountApp()
    const imported = studioFile()
    await importJson(wrapper, imported)

    const stored = loadStudioSchemes()
    expect(stored.map(document => document.id)).toEqual([FIRST_ID, IMPORTED_ID])
    expect(stored[1].file).toEqual(imported)
    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Главный зал')
    expect(editor(wrapper).props('initialObjects')).toEqual(imported.objects)
  })

  it('keeps the selected document when an imported v2 envelope is malformed', async () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const wrapper = await mountApp()

    await importJson(wrapper, { ...studioFile('Чужая схема'), offers: [] })

    expect(wrapper.text()).toContain(FORMAT_ERROR)
    expect(loadStudioSchemes()).toEqual([existing])
    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Партер')
  })

  it('persists editor events only into the selected document and exports its exact JSON', async () => {
    const first = createStudioScheme('Партер')
    const second = createStudioScheme('Балкон')
    second.file.scheme.group_name = 'Театры'
    saveStudioSchemes([first, second])

    let exportedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob) {
        exportedBlob = value
      }
      return 'blob:studio-export'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const wrapper = await mountApp()
    await wrapper.findAll('[data-testid="studio-document"]')[1].find('button').trigger('click')
    const file = studioFile('Балкон')
    const editorObjects = file.objects.map(object => ({ ...object, capacity: 80 }))

    editor(wrapper).vm.$emit(
      'save',
      file.schema_json.canvas,
      editorObjects,
      file.schema_json.price_groups,
    )
    await flushPromises()

    const storedAfterSave = loadStudioSchemes()
    expect(storedAfterSave).toHaveLength(2)
    expect(storedAfterSave[0].file).toEqual(first.file)
    expect(storedAfterSave[1].file).toEqual(file)

    editor(wrapper).vm.$emit(
      'export',
      file.schema_json.canvas,
      editorObjects,
      file.schema_json.price_groups,
    )
    await flushPromises()

    expect(exportedBlob).toBeInstanceOf(Blob)
    expect(JSON.parse(await exportedBlob!.text())).toEqual(file)
    expect(editor(wrapper).props('storageKey')).toBeNull()
    expect(editor(wrapper).props('externalFileHandling')).toBe(true)
    expect(localStorage.getItem('fpass-scheme-studio:draft')).toBeNull()
  })

  it('keeps schema_json.display on save and export, and omits it when absent', async () => {
    const withoutDisplay = createStudioScheme('Партер')
    const withDisplay = createStudioScheme('Балкон')
    withDisplay.file.schema_json.display = {
      section_contents: 'after_zoom',
      sector_price_labels: true,
    }
    saveStudioSchemes([withoutDisplay, withDisplay])

    let exportedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      if (value instanceof Blob) {
        exportedBlob = value
      }
      return 'blob:studio-export'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const wrapper = await mountApp()

    editor(wrapper).vm.$emit(
      'save',
      withoutDisplay.file.schema_json.canvas,
      withoutDisplay.file.objects,
      withoutDisplay.file.schema_json.price_groups,
      null,
    )
    await flushPromises()
    editor(wrapper).vm.$emit(
      'export',
      withoutDisplay.file.schema_json.canvas,
      withoutDisplay.file.objects,
      withoutDisplay.file.schema_json.price_groups,
      null,
    )
    await flushPromises()

    const storedWithoutDisplay = loadStudioSchemes().find(document => document.id === withoutDisplay.id)
    expect(storedWithoutDisplay?.file.schema_json.display).toBeUndefined()
    expect(Object.hasOwn(storedWithoutDisplay?.file.schema_json ?? {}, 'display')).toBe(false)
    expect(exportedBlob).toBeInstanceOf(Blob)
    const exportedWithoutDisplay = JSON.parse(await exportedBlob!.text())
    expect(Object.hasOwn(exportedWithoutDisplay.schema_json, 'display')).toBe(false)

    await wrapper.findAll('[data-testid="studio-document"]')[1].find('button').trigger('click')

    editor(wrapper).vm.$emit(
      'save',
      withDisplay.file.schema_json.canvas,
      withDisplay.file.objects,
      withDisplay.file.schema_json.price_groups,
      withDisplay.file.schema_json.display,
    )
    await flushPromises()
    editor(wrapper).vm.$emit(
      'export',
      withDisplay.file.schema_json.canvas,
      withDisplay.file.objects,
      withDisplay.file.schema_json.price_groups,
      withDisplay.file.schema_json.display,
    )
    await flushPromises()

    const storedWithDisplay = loadStudioSchemes().find(document => document.id === withDisplay.id)
    expect(storedWithDisplay?.file.schema_json.display).toEqual({
      section_contents: 'after_zoom',
      sector_price_labels: true,
    })
    expect(exportedBlob).toBeInstanceOf(Blob)
    const exportedWithDisplay = JSON.parse(await exportedBlob!.text())
    expect(exportedWithDisplay.schema_json.display).toEqual({
      section_contents: 'after_zoom',
      sector_price_labels: true,
    })
  })

  it('passes the stored display settings to the editor', async () => {
    const wrapper = await mountApp()
    const file = studioFile()
    const imported = {
      ...file,
      schema_json: {
        ...file.schema_json,
        display: { section_contents: 'after_zoom', sector_price_labels: true },
      },
    }
    await importJson(wrapper, imported)

    expect(editor(wrapper).props('initialDisplay')).toEqual({
      section_contents: 'after_zoom',
      sector_price_labels: true,
    })
  })

  it('stores the display emitted by the editor and drops it when the editor emits null', async () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const wrapper = await mountApp()
    const file = studioFile('Партер')

    editor(wrapper).vm.$emit(
      'save',
      file.schema_json.canvas,
      file.objects,
      file.schema_json.price_groups,
      { section_contents: 'always', sector_price_labels: false },
    )
    await flushPromises()

    expect(loadStudioSchemes()[0].file.schema_json.display).toEqual({
      section_contents: 'always',
      sector_price_labels: false,
    })

    editor(wrapper).vm.$emit(
      'save',
      file.schema_json.canvas,
      file.objects,
      file.schema_json.price_groups,
      null,
    )
    await flushPromises()

    expect(Object.hasOwn(loadStudioSchemes()[0].file.schema_json, 'display')).toBe(false)
  })

  it('remounts the package editor when another document is selected', async () => {
    saveStudioSchemes([
      createStudioScheme('Партер'),
      createStudioScheme('Балкон'),
    ])
    const wrapper = await mountApp()
    const firstInstance = wrapper.get('[data-testid="seat-map-editor"]').attributes('data-instance')

    await wrapper.findAll('[data-testid="studio-document"]')[1].find('button').trigger('click')

    expect(wrapper.get('[data-testid="seat-map-editor"]').attributes('data-instance')).not.toBe(firstInstance)
  })

  it('deletes a document only after confirmation and selects the remaining document', async () => {
    const first = createStudioScheme('Партер')
    const second = createStudioScheme('Балкон')
    saveStudioSchemes([first, second])
    const confirm = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const wrapper = await mountApp()

    await wrapper.get('[aria-label="Удалить Партер"]').trigger('click')

    await flushPromises()
    expect(loadStudioSchemes()).toHaveLength(2)

    await wrapper.get('[aria-label="Удалить Партер"]').trigger('click')

    await flushPromises()

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(loadStudioSchemes().map(document => document.file.scheme.name)).toEqual(['Балкон'])
    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Балкон')
    expect(editor(wrapper).props('initialCanvas')).toEqual(second.file.schema_json.canvas)
  })

  it('stores a buyer preview snapshot and opens the buyer simulation tab', async () => {
    const existing = createStudioScheme('Партер')
    saveStudioSchemes([existing])
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = await mountApp()
    const file = studioFile('Партер')
    const display = { section_contents: 'after_zoom' as const, sector_price_labels: true }

    expect(editor(wrapper).props('buyerPreviewEnabled')).toBe(true)

    editor(wrapper).vm.$emit('buyer-preview', file.schema_json.canvas, file.objects, file.schema_json.price_groups, display)
    await flushPromises()

    const stored = JSON.parse(localStorage.getItem(`fpass-scheme-studio:buyer-preview:${existing.id}`)!)
    expect(stored).toEqual({
      name: 'Партер',
      canvas: file.schema_json.canvas,
      objects: file.objects,
      priceGroups: file.schema_json.price_groups,
      display,
      createdAt: expect.any(String),
    })
    expect(open).toHaveBeenCalledWith(`${window.location.href.split('#')[0]}#/buyer/${existing.id}`, '_blank')
  })

  it('shows the persistence error and does not open the tab when the snapshot cannot be stored', async () => {
    const backingStorage = localStorage
    saveStudioSchemes([createStudioScheme('Партер')], backingStorage)
    vi.stubGlobal('localStorage', new FailingStorage(backingStorage, 'write'))
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = await mountApp()
    const file = studioFile('Партер')

    editor(wrapper).vm.$emit('buyer-preview', file.schema_json.canvas, file.objects, file.schema_json.price_groups, null)
    await flushPromises()

    expect(wrapper.get('[data-testid="persistence-error"]').text()).toContain('предпросмотр покупателя')
    expect(open).not.toHaveBeenCalled()
  })
})
