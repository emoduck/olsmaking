/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5287',
        changeOrigin: false,
      },
      '/signin-oidc': {
        target: 'http://localhost:5287',
        changeOrigin: false,
      },
      '/signout-callback-oidc': {
        target: 'http://localhost:5287',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
