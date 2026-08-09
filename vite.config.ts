import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { copyFileSync, existsSync } from 'node:fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Vercel a veces ignora rewrites con preset Vite → 404 en /ranking etc.
        // Servir el mismo HTML como 404 deja que React Router tome el control.
        name: 'spa-fallback-404',
        closeBundle() {
          const index = path.resolve(__dirname, 'dist/index.html')
          const fallback = path.resolve(__dirname, 'dist/404.html')
          if (existsSync(index)) copyFileSync(index, fallback)
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // IPv4 + IPv6: Spotify OAuth exige 127.0.0.1 (no acepta localhost)
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
