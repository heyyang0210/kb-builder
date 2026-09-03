import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.PINGCODE_WEB_BACKEND || 'http://127.0.0.1:3500'
  return {
    plugins: [vue()],
    base: '/pingcode-materials/',
    build: {
      // 保留 500 kB 告警阈值；按高成本依赖域拆包。
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('monaco-editor')) return 'vendor-editor'
            if (id.includes('mermaid')) return 'vendor-mermaid'
            if (id.includes('echarts')) return 'vendor-echarts'
            if (id.includes('cytoscape')) return 'vendor-cytoscape'
            if (id.includes('katex')) return 'vendor-katex'
            if (id.includes('marked')) return 'vendor-markdown'
            if (id.includes('vue') || id.includes('vue-router')) return 'vendor-vue'
            return 'vendor'
          },
        },
      },
    },
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
