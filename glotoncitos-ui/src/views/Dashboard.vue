<script setup>
import { computed } from 'vue'
import { useSesionStore } from '../stores/sesion'
import { useDatosStore } from '../stores/datos'
import { formatearPrecio } from '../utils/formato'

const sesion = useSesionStore()
const datos = useDatosStore()

const maximoPlatos = computed(() => {
  const cantidades = datos.platosMasPedidos.map((p) => p.cantidad)
  return cantidades.length ? Math.max(...cantidades) : 1
})

const tarjetas = computed(() => [
  { titulo: 'Ventas del día', valor: formatearPrecio(datos.ventasDelDia), detalle: 'Suma de las cuentas cerradas', color: 'text-cafe-800' },
  { titulo: 'Pedidos', valor: String(datos.numeroPedidos), detalle: 'Activos + cerrados hoy', color: 'text-cafe-800' },
  { titulo: 'Mesas ocupadas', valor: String(datos.mesasOcupadas.length), detalle: `${datos.mesas.length} mesas en total`, color: 'text-durazno-500' },
  { titulo: 'Mesas libres', valor: String(datos.mesasLibres.length), detalle: 'Disponibles para atender', color: 'text-green-700' },
])
</script>

<template>
  <div class="pt-8">
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Dashboard</h1>
      <p class="text-sm text-cafe-500">
        Resumen del día para {{ sesion.rolActivo?.nombre?.toLowerCase() }}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="tarjeta in tarjetas"
        :key="tarjeta.titulo"
        class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm"
      >
        <p class="text-xs font-bold uppercase tracking-wide text-cafe-500">{{ tarjeta.titulo }}</p>
        <p class="mt-1 text-3xl font-extrabold" :class="tarjeta.color">{{ tarjeta.valor }}</p>
        <p class="mt-1 text-xs text-cafe-400">{{ tarjeta.detalle }}</p>
      </div>
    </div>

    <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm lg:col-span-3">
        <h2 class="mb-1 text-sm font-bold uppercase tracking-wide text-cafe-500">Platos más pedidos</h2>
        <p class="mb-4 text-xs text-cafe-400">Calculado a partir de los pedidos de la sesión</p>

        <ul v-if="datos.platosMasPedidos.length" class="space-y-3">
          <li
            v-for="plato in datos.platosMasPedidos"
            :key="plato.nombre"
            class="flex items-center gap-3"
          >
            <span class="w-44 flex-none truncate text-sm font-semibold text-cafe-800">
              {{ plato.nombre }}
            </span>
            <div class="relative h-6 flex-1 overflow-hidden rounded-lg bg-crema-100">
              <div
                class="h-full rounded-lg bg-gradient-to-r from-durazno-400 to-durazno-500"
                :style="{ width: Math.round((plato.cantidad / maximoPlatos) * 100) + '%' }"
              ></div>
            </div>
            <span class="w-8 flex-none text-right text-sm font-bold text-cafe-700">
              {{ plato.cantidad }}
            </span>
          </li>
        </ul>
        <p v-else class="py-8 text-center text-sm text-cafe-400">Aún no hay pedidos registrados.</p>
      </section>

      <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 class="mb-4 text-sm font-bold uppercase tracking-wide text-cafe-500">Trabajadores</h2>
        <div v-for="trabajador in datos.trabajadores" :key="trabajador.nombre">
          <div class="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-crema-100">
            <span class="font-semibold text-cafe-800">{{ trabajador.nombre }}</span>
            <span class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cafe-600" :class="trabajador.rol === 'Mesero' || trabajador.rol === 'Mesera' ? 'bg-durazno-100' : trabajador.rol === 'Administrador' ? 'bg-cafe-200' : trabajador.rol === 'Cajero' || trabajador.rol === 'Cajera' ? 'bg-green-100' : 'bg-amber-100'">
              {{ trabajador.rol }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>