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
    host: '0.0.0.0', // Expose to network
    watch: {
      ignored: ['**/settings.json', '**/node_modules/**', '**/.git/**'],
    },
  },
})

