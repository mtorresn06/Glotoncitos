import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Login from '../views/Login.vue';
import PanelMesas from '../views/PanelMesas.vue';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: Login },
  { path: '/mesas', name: 'mesas', component: PanelMesas, meta: { requiereAuth: true } },
  // TODO: /cocina (Sprint 2/3), /caja (Sprint 3), /dashboard (Sprint 4)
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// RF-20: acceso restringido — sin sesión, redirige a login
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiereAuth && !auth.estaAutenticado) {
    return { name: 'login' };
  }
});

export default router;
