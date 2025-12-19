import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Ignore settings.json to prevent HMR when speed profile changes
      ignored: ['**/settings.json', '**/node_modules/**', '**/.git/**'],
    },
  },
})
