import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'
const allowedHosts = parseAllowedHosts(process.env.VITE_ALLOWED_HOSTS)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts,
    proxy: {
      '/api': apiProxyTarget,
    },
  },
  preview: {
    allowedHosts,
    proxy: {
      '/api': apiProxyTarget,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

function parseAllowedHosts(value: string | undefined) {
  if (!value) {
    return undefined
  }

  if (value === 'true') {
    return true
  }

  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}
