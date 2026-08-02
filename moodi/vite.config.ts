import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const backendOrigin = (
    environment.VITE_BACKEND_ORIGIN ||
    environment.VITE_API_BASE_URL ||
    'http://localhost:8080'
  ).replace(/\/$/, '')

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      // Backend와 Google login의 local allowed origin은 localhost:5173이다.
      host: 'localhost',
      port: 5173,
      proxy: {
        '/api': { target: backendOrigin, changeOrigin: true },
        '/health': { target: backendOrigin, changeOrigin: true },
      },
    },
  }
})
