<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);

const auth = useAuthStore();
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push('/mesas');
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudo iniciar sesión';
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-crema flex items-center justify-center p-6">
    <div class="bg-white rounded-xl2 shadow-lg p-8 w-full max-w-sm">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-cafe-oscuro">Glotoncitos</h1>
        <p class="text-sm text-cafe">Sistema de Gestión Integral de Restaurantes</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <input
          v-model="email"
          type="email"
          placeholder="Correo electrónico"
          required
          class="w-full rounded-full border border-durazno px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cafe"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Contraseña"
          required
          class="w-full rounded-full border border-durazno px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cafe"
        />

        <p v-if="error" class="text-sm text-ocupada text-center">{{ error }}</p>

        <button
          type="submit"
          :disabled="cargando"
          class="w-full rounded-full bg-cafe text-white py-2 font-semibold hover:bg-cafe-oscuro transition disabled:opacity-60"
        >
          {{ cargando ? 'Ingresando...' : 'Login' }}
        </button>
      </form>

      <p class="text-xs text-center text-cafe mt-4">
        Prueba: admin@glotoncitos.test / Glotoncitos2026
      </p>
    </div>
  </div>
</template>
