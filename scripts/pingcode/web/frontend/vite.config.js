import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.PINGCODE_WEB_BACKEND || 'http://127.0.0.1:3500'
  return {
    plugins: [vue()],
    base: '/pingcode-materials/',
    server: {
      port: Number(env.PINGCODE_WEB_FRONTEND_PORT || 3501),
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/pingcode-api': {
          target: backend,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/pingcode-api/, ''),
        },
      },
    },
  }
})
