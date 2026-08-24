import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import {
  createStudioScheme,
  loadStudioSchemes,
  saveStudioSchemes,
  type StudioSchemeFile,
} from './schemes/library'

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
        storageKey: { type: String, default: null },
        externalFileHandling: { type: Boolean, default: false },
      },
      emits: ['save', 'export'],
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
        capacity: 80,
      },
    ],
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

function editor(wrapper: VueWrapper) {
  const component = wrapper.findComponent({ name: 'SeatMapEditor' })
  if (!component.exists()) {
    throw new Error('SeatMapEditor not found')
  }

  return component
}

describe('standalone Studio document manager', () => {
  beforeEach(() => {
    localStorage.clear()
    editorMounts.count = 0
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    expect(fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates, names and selects independent local documents', async () => {
    const wrapper = mount(App)

    await button(wrapper, 'Создать схему').trigger('click')
    await wrapper.get('[data-testid="scheme-name"]').setValue('Партер')

    await button(wrapper, 'Создать схему').trigger('click')
    await wrapper.get('[data-testid="scheme-name"]').setValue('Балкон')

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

  it('imports exact JSON v2 under a collision-safe local id and selects it', async () => {
    const existing = createStudioScheme('Существующая схема')
    existing.id = FIRST_ID
    saveStudioSchemes([existing])

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(FIRST_ID)
      .mockReturnValueOnce(IMPORTED_ID)

    const wrapper = mount(App)
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
    const wrapper = mount(App)

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

    const wrapper = mount(App)
    await wrapper.findAll('[data-testid="studio-document"]')[1].find('button').trigger('click')
    const file = studioFile('Балкон')

    editor(wrapper).vm.$emit(
      'save',
      file.schema_json.canvas,
      file.objects,
      file.schema_json.price_groups,
    )
    await flushPromises()

    expect(loadStudioSchemes()[0].file).toEqual(first.file)
    expect(loadStudioSchemes()[1].file).toEqual(file)

    editor(wrapper).vm.$emit(
      'export',
      file.schema_json.canvas,
      file.objects,
      file.schema_json.price_groups,
    )
    await flushPromises()

    expect(exportedBlob).toBeInstanceOf(Blob)
    expect(JSON.parse(await exportedBlob!.text())).toEqual(file)
    expect(editor(wrapper).props('storageKey')).toBeNull()
    expect(editor(wrapper).props('externalFileHandling')).toBe(true)
    expect(localStorage.getItem('fpass-scheme-studio:draft')).toBeNull()
  })

  it('remounts the package editor when another document is selected', async () => {
    saveStudioSchemes([
      createStudioScheme('Партер'),
      createStudioScheme('Балкон'),
    ])
    const wrapper = mount(App)
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
    const wrapper = mount(App)

    await wrapper.get('[aria-label="Удалить Партер"]').trigger('click')
    expect(loadStudioSchemes()).toHaveLength(2)

    await wrapper.get('[aria-label="Удалить Партер"]').trigger('click')

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(loadStudioSchemes().map(document => document.file.scheme.name)).toEqual(['Балкон'])
    expect((wrapper.get('[data-testid="scheme-name"]').element as HTMLInputElement).value).toBe('Балкон')
    expect(editor(wrapper).props('initialCanvas')).toEqual(second.file.schema_json.canvas)
  })
})
