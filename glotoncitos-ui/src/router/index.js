import { createRouter, createWebHistory } from 'vue-router'
import { ROLES, useSesionStore } from '../stores/sesion'
import SelectorRol from '../views/SelectorRol.vue'
import PanelMesas from '../views/PanelMesas.vue'
import PanelCocina from '../views/PanelCocina.vue'
import PanelCaja from '../views/PanelCaja.vue'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: SelectorRol, meta: { publico: true } },
    { path: '/mesas', name: 'mesas', component: PanelMesas, meta: { conSesion: true } },
    { path: '/cocina', name: 'cocina', component: PanelCocina, meta: { conSesion: true } },
    { path: '/caja', name: 'caja', component: PanelCaja, meta: { conSesion: true } },
    { path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { conSesion: true } },
  ],
})

export function rutaParaRol(rolId) {
  return ROLES[rolId] ? ROLES[rolId].pantalla : '/'
}

router.beforeEach((to) => {
  const sesion = useSesionStore()

  if (to.meta.conSesion && !sesion.rolId) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && sesion.rolId) {
    return { path: rutaParaRol(sesion.rolId) }
  }

  return true
})

export default router