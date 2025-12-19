import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Preview config - runs on port 5174 with preview.html as entry
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    rollupOptions: {
      input: 'preview.html'
    }
  },
  server: {
    port: 5174,
    open: '/preview.html'
  }
})

