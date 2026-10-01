import { Laptop, Maximize2, Monitor, Smartphone, Tablet } from '@lucide/vue'
import type { Component } from 'vue'

export interface BuyerDevice {
  id: 'desktop' | 'laptop' | 'tablet' | 'phone' | 'fill'
  label: string
  size: { width: number, height: number } | null
  icon: Component
}

export const BUYER_DEVICES: readonly BuyerDevice[] = [
  { id: 'desktop', label: '1920 · Десктоп', size: { width: 1920, height: 1080 }, icon: Monitor },
  { id: 'laptop', label: '1440 · Ноутбук', size: { width: 1440, height: 900 }, icon: Laptop },
  { id: 'tablet', label: '768 · Планшет', size: { width: 768, height: 1024 }, icon: Tablet },
  { id: 'phone', label: '375 · Телефон', size: { width: 375, height: 812 }, icon: Smartphone },
  { id: 'fill', label: 'Во всё окно', size: null, icon: Maximize2 },
]

export const SOLD_PERCENT_OPTIONS = [0, 30, 70] as const

export function fitScale(
  size: { width: number, height: number },
  available: { width: number, height: number },
): number {
  if (available.width <= 0 || available.height <= 0) {
    return 1
  }

  return Math.min(1, available.width / size.width, available.height / size.height)
}
