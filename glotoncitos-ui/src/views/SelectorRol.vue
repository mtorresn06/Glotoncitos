<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSesionStore } from '../stores/sesion'
import { rutaParaRol } from '../router'

const router = useRouter()
const route = useRoute()
const sesion = useSesionStore()

const email = ref('')
const password = ref('')

async function ingresar() {
  try {
    await sesion.iniciarSesion({
      email: email.value,
      password: password.value,
    })

    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : rutaParaRol(sesion.rolId)
    router.replace(destino)
  } catch {
    password.value = ''
  }
}
</script>

<template>
  <section class="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 sm:py-16">
    <div class="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-crema-50 shadow-suave sm:grid-cols-[1.05fr_0.95fr]">
      <div class="relative flex min-h-[32rem] flex-col justify-between bg-cafe-800 p-8 text-crema-50 sm:p-12">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgb(217_127_63_/_0.35),_transparent_42%)]"></div>
        <div class="relative">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-durazno-400 text-2xl font-extrabold text-cafe-900 shadow-suave">
            G
          </span>
          <p class="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-durazno-200">
            Bienvenido a
          </p>
          <h1 class="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Glotoncitos
          </h1>
          <p class="mt-5 max-w-md text-lg leading-relaxed text-crema-100/90">
            El sistema para administrar mesas, pedidos, cocina y pagos de tu restaurante en un solo lugar.
          </p>
        </div>

        <div class="relative grid grid-cols-3 gap-3 pt-12 text-center">
          <div>
            <p class="text-2xl font-extrabold text-durazno-300">4</p>
            <p class="mt-1 text-xs font-semibold text-crema-100/80">Roles</p>
          </div>
          <div>
            <p class="text-2xl font-extrabold text-durazno-300">1</p>
            <p class="mt-1 text-xs font-semibold text-crema-100/80">Acceso</p>
          </div>
          <div>
            <p class="text-2xl font-extrabold text-durazno-300">24/7</p>
            <p class="mt-1 text-xs font-semibold text-crema-100/80">Gestión</p>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-center bg-crema-50 p-6 sm:p-10">
        <form class="w-full max-w-md" @submit.prevent="ingresar">
          <div>
            <p class="text-sm font-bold uppercase tracking-[0.2em] text-durazno-500">Iniciar sesión</p>
            <h2 class="mt-2 text-3xl font-extrabold tracking-tight text-cafe-800">
              Ingresa a tu cuenta
            </h2>
            <p class="mt-2 text-sm text-cafe-500">
              Usa el correo y la contraseña asignados por el administrador.
            </p>
          </div>

          <div class="mt-8 space-y-5">
            <label class="block">
              <span class="mb-2 block text-sm font-bold text-cafe-700">Correo electrónico</span>
              <input
                v-model="email"
                type="email"
                autocomplete="username"
                placeholder="nombre@restaurante.com"
                required
                class="w-full rounded-xl border border-cafe-900/10 bg-white px-4 py-3 text-cafe-900 placeholder:text-cafe-400 outline-none transition focus:border-durazno-400 focus:ring-4 focus:ring-durazno-200"
              />
            </label>

            <label class="block">
              <span class="mb-2 block text-sm font-bold text-cafe-700">Contraseña</span>
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                placeholder="Tu contraseña"
                required
                class="w-full rounded-xl border border-cafe-900/10 bg-white px-4 py-3 text-cafe-900 placeholder:text-cafe-400 outline-none transition focus:border-durazno-400 focus:ring-4 focus:ring-durazno-200"
              />
            </label>
          </div>

          <p
            v-if="sesion.error"
            role="alert"
            class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {{ sesion.error }}
          </p>

          <button
            type="submit"
            :disabled="sesion.cargando"
            class="mt-6 w-full rounded-xl bg-cafe-700 px-5 py-3.5 text-base font-extrabold text-crema-50 shadow-suave transition hover:bg-cafe-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ sesion.cargando ? 'Ingresando...' : 'Entrar al sistema' }}
          </button>

          <p class="mt-5 text-center text-xs leading-relaxed text-cafe-500">
            Al entrar, el sistema te dirigirá al panel correspondiente a tu rol.
          </p>
        </form>
      </div>
    </div>
  </section>
</template>
