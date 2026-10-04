import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_HOST = 'https://b8z1k0f7p6.execute-api.us-east-2.amazonaws.com'

export default defineConfig({
  plugins: [react()],
  server: {
    // The API doesn't send Access-Control-Allow-Origin on real responses (only on OPTIONS),
    // so in dev we proxy through Vite and the browser sees a same-origin request.
    proxy: {
      '/api': { target: API_HOST, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '/development') },
    },
  },
})
