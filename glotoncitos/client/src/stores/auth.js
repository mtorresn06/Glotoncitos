import { defineStore } from 'pinia';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('gt_token') || null,
    usuario: JSON.parse(localStorage.getItem('gt_usuario') || 'null'),
  }),
  getters: {
    estaAutenticado: (state) => !!state.token,
  },
  actions: {
    // RF-01: iniciar sesión mediante credenciales de acceso
    async login(email, password) {
      const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
      this.token = data.token;
      this.usuario = data.usuario;
      localStorage.setItem('gt_token', data.token);
      localStorage.setItem('gt_usuario', JSON.stringify(data.usuario));
    },
    logout() {
      this.token = null;
      this.usuario = null;
      localStorage.removeItem('gt_token');
      localStorage.removeItem('gt_usuario');
    },
  },
});
