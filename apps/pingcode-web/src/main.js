import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import SpacesPage from './views/SpacesPage.vue'
import { initRuntimeConfig } from './api'
import './styles.css'

const routes = [
  { path: '/', redirect: '/workbench' },
  { path: '/workbench', component: () => import('./views/WorkbenchPage.vue') },
  { path: '/upload', component: () => import('./views/UploadPage.vue') },
  { path: '/spaces', component: SpacesPage },
  { path: '/batches', component: () => import('./views/BatchesPage.vue') },
  { path: '/batches/:batchId/download', component: () => import('./views/DownloadPage.vue') },
  { path: '/batches/:batchId/preprocess', component: () => import('./views/PreprocessPage.vue') },
  { path: '/batches/:batchId/quality', component: () => import('./views/QualityPage.vue') },
  { path: '/knowledge', component: () => import('./views/KnowledgeIndexPage.vue') },
  { path: '/knowledge/graph', component: () => import('./views/KnowledgeGraphPage.vue') },
]

const router = createRouter({
  history: createWebHistory('/pingcode-materials/'),
  routes,
})

await initRuntimeConfig()
createApp(App).use(router).mount('#app')
