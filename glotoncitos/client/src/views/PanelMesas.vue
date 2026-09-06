<script setup>
import { onMounted, ref, computed } from 'vue';
import { useMesasStore } from '../stores/mesas';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import MesaCard from '../components/MesaCard.vue';

const mesasStore = useMesasStore();
const auth = useAuthStore();
const router = useRouter();

const pisoActivo = ref(1);
const pisos = computed(() => [...new Set(mesasStore.mesas.map((m) => m.piso))].sort());
const mesasDelPiso = computed(() => mesasStore.mesas.filter((m) => m.piso === pisoActivo.value));

onMounted(() => mesasStore.fetchMesas());

function cerrarSesion() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-crema p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-cafe-oscuro">Glotoncitos</h1>
      <div class="flex items-center gap-4">
        <span class="text-sm text-cafe">{{ auth.usuario?.nombre }} · {{ auth.usuario?.rol }}</span>
        <button class="text-sm text-ocupada" @click="cerrarSesion">Salir</button>
      </div>
    </header>

    <h2 class="text-2xl font-bold text-cafe-oscuro mb-4">Panel de Mesas</h2>

    <div class="flex gap-2 mb-6">
      <button
        v-for="piso in pisos"
        :key="piso"
        class="px-3 py-1 rounded-full text-sm font-medium"
        :class="piso === pisoActivo ? 'bg-cafe text-white' : 'bg-white text-cafe border border-durazno'"
        @click="pisoActivo = piso"
      >
        Piso {{ piso }}
      </button>
    </div>

    <p v-if="mesasStore.cargando" class="text-cafe">Cargando mesas...</p>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <MesaCard
        v-for="mesa in mesasDelPiso"
        :key="mesa.id"
        :mesa="mesa"
        @toggle="mesasStore.toggleEstado"
      />
    </div>
  </div>
</template>
