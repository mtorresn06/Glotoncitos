<script setup>
import { RouterView } from 'vue-router'
import { useSesionStore } from './stores/sesion'
import BarraSuperior from './components/BarraSuperior.vue'

const sesion = useSesionStore()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-crema-100">
    <BarraSuperior v-if="sesion.rolId" />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>