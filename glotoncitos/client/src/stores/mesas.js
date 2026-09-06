import { defineStore } from 'pinia';
import axios from 'axios';
import { useAuthStore } from './auth';

const API_URL = import.meta.env.VITE_API_URL;

function authHeaders() {
  const auth = useAuthStore();
  return { headers: { Authorization: `Bearer ${auth.token}` } };
}

export const useMesasStore = defineStore('mesas', {
  state: () => ({
    mesas: [],
    cargando: false,
  }),
  actions: {
    // RF-05: consultar el mapa de mesas junto con su estado actual
    async fetchMesas() {
      this.cargando = true;
      try {
        const { data } = await axios.get(`${API_URL}/mesas`, authHeaders());
        this.mesas = data;
      } finally {
        this.cargando = false;
      }
    },
    // RF-06: actualizar el estado de una mesa entre libre y ocupada
    async toggleEstado(mesa) {
      const nuevoEstado = mesa.estado === 'LIBRE' ? 'OCUPADA' : 'LIBRE';
      const { data } = await axios.patch(
        `${API_URL}/mesas/${mesa.id}/estado`,
        { estado: nuevoEstado },
        authHeaders()
      );
      const idx = this.mesas.findIndex((m) => m.id === mesa.id);
      if (idx !== -1) this.mesas[idx] = data;
    },
  },
});
