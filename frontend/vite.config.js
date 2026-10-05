import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 43124,
    allowedHosts: ['.trycloudflare.com', '.devtunnels.ms'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true,
      },
      // Host header kept so Django's CSRF origin check accepts the admin login form.
      '^/admin/': 'http://127.0.0.1:8765',
      '^/static/': 'http://127.0.0.1:8765',
    },
  },
})
