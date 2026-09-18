<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSesionStore } from '../stores/sesion'
import { rutaParaRol } from '../router'

const router = useRouter()
const sesion = useSesionStore()

const enlaces = computed(() => {
  if (!sesion.rolId) return []
  if (sesion.rolId === 'administrador') {
    return [
      { ruta: '/dashboard', nombre: 'Dashboard' },
      { ruta: '/mesas', nombre: 'Panel de Mesas' },
    ]
  }
  return [{ ruta: rutaParaRol(sesion.rolId), nombre: sesion.rolActivo.titulo }]
})

function cerrarSesion() {
  sesion.cerrarSesion()
  router.push('/')
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-cafe-900/10 bg-crema-50/90 shadow-sm backdrop-blur">
    <div class="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
      <div class="flex items-center gap-2.5">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-cafe-700 text-lg font-bold text-crema-50 shadow"
        >
          G
        </span>
        <div class="leading-tight">
          <p class="text-lg font-extrabold tracking-tight text-cafe-800">Glotoncitos</p>
          <p class="text-xs text-cafe-500">Gestión de restaurante</p>
        </div>
      </div>

      <nav v-if="enlaces.length" class="ml-2 flex items-center gap-1 sm:ml-6">
        <RouterLink
          v-for="enlace in enlaces"
          :key="enlace.ruta"
          :to="enlace.ruta"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
          active-class="bg-cafe-700 text-crema-50"
          exact-active-class="bg-cafe-700 text-crema-50"
        >
          {{ enlace.nombre }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <span
          class="hidden rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white sm:inline-block"
          :class="sesion.rolActivo?.color"
        >
          {{ sesion.rolActivo?.nombre }}
        </span>
        <button
          type="button"
          class="rounded-lg border border-cafe-700/25 bg-white px-3 py-1.5 text-sm font-semibold text-cafe-700 transition-colors hover:bg-cafe-700 hover:text-crema-50"
          @click="cerrarSesion"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  </header>
</template>