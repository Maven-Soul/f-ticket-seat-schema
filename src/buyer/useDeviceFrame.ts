import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type CSSProperties, type Ref } from 'vue'

import { fitScale, type BuyerDevice } from './devices'

const STAGE_PADDING = 24

export interface DeviceFrame {
  frameWidth: ComputedRef<string>
  frameHeight: ComputedRef<string>
  frameBoxStyle: ComputedRef<CSSProperties>
  frameStyle: ComputedRef<CSSProperties>
  sizeCaption: ComputedRef<string>
}

export function useDeviceFrame(device: Readonly<Ref<BuyerDevice>>, stage: Readonly<Ref<HTMLElement | null>>): DeviceFrame {
  const stageSize = ref({ width: 0, height: 0 })

  const scale = computed(() => {
    const size = device.value.size
    return size === null ? 1 : fitScale(size, {
      width: stageSize.value.width - STAGE_PADDING * 2,
      height: stageSize.value.height - STAGE_PADDING * 2,
    })
  })
  const frameWidth = computed(() => (device.value.size ? String(device.value.size.width) : '100%'))
  const frameHeight = computed(() => (device.value.size ? String(device.value.size.height) : '100%'))
  const frameBoxStyle = computed<CSSProperties>(() => {
    const size = device.value.size
    return size === null
      ? { width: '100%', height: '100%' }
      : { width: `${size.width * scale.value}px`, height: `${size.height * scale.value}px` }
  })
  const frameStyle = computed<CSSProperties>(() => {
    const size = device.value.size
    return size === null
      ? { width: '100%', height: '100%' }
      : { width: `${size.width}px`, height: `${size.height}px`, transform: `scale(${scale.value})` }
  })
  const sizeCaption = computed(() => {
    const size = device.value.size
    return size === null
      ? 'Во всё окно · 100%'
      : `${size.width} × ${size.height} · масштаб ${Math.round(scale.value * 100)}%`
  })

  function measureStage(): void {
    stageSize.value = {
      width: stage.value?.clientWidth ?? 0,
      height: stage.value?.clientHeight ?? 0,
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    measureStage()
    window.addEventListener('resize', measureStage)
    if (typeof ResizeObserver !== 'undefined' && stage.value) {
      resizeObserver = new ResizeObserver(measureStage)
      resizeObserver.observe(stage.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', measureStage)
    resizeObserver?.disconnect()
  })

  return { frameWidth, frameHeight, frameBoxStyle, frameStyle, sizeCaption }
}
