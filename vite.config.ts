import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: { dedupe: ['vue', '@lucide/vue', 'konva'] },
  server: { port: 5174, strictPort: true },
})
