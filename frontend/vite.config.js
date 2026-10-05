import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // A production bundle must never silently fall back to a dev/test API.
  if (command === 'build' && !env.VITE_API_BASE) {
    throw new Error('VITE_API_BASE is required for a production build (e.g. https://<api-id>.execute-api.<region>.amazonaws.com/<stage>)')
  }

  return {
    plugins: [react()],
    server: {
      // The API doesn't send Access-Control-Allow-Origin on real responses (only on OPTIONS),
      // so in dev we proxy through Vite and the browser sees a same-origin request.
      // VITE_DEV_API_TARGET is the API host + stage, e.g. https://<id>.execute-api.<region>.amazonaws.com/development
      proxy: env.VITE_DEV_API_TARGET
        ? {
            '/api': {
              target: new URL(env.VITE_DEV_API_TARGET).origin,
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/api/, new URL(env.VITE_DEV_API_TARGET).pathname.replace(/\/$/, '')),
            },
          }
        : undefined,
    },
  }
})
