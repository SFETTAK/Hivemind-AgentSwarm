import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hivemind/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@hivemind/core': path.resolve(__dirname, '../../packages/core/src'),
    }
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/settings.json', '**/node_modules/**', '**/.git/**'],
    },
  },
})

