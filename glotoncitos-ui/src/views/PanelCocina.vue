<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import { ETIQUETAS_ESTADO, formatearPrecio, formatearTiempo } from '../utils/formato'

const datos = useDatosStore()

const ahora = ref(Date.now())
let temporizador

onMounted(() => {
  temporizador = setInterval(() => {
    ahora.value = Date.now()
  }, 10000)
})

onBeforeUnmount(() => clearInterval(temporizador))

const pedidosActivos = computed(() => datos.pedidos)

const clasesEstado = {
  pendiente: 'bg-crema-200 text-cafe-700',
  en_preparacion: 'bg-amber-200 text-amber-900',
  listo: 'bg-green-100 text-green-800',
}

const etiquetasAccion = {
  pendiente: 'Empezar preparación',
  en_preparacion: 'Marcar listo',
  listo: 'Listo',
}

function avanzar(pedidoId, indice) {
  datos.avanzarProducto(pedidoId, indice)
}
</script>

<template>
  <div class="pt-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Panel de Cocina</h1>
        <p class="text-sm text-cafe-500">
          {{ pedidosActivos.length }} pedido(s) activo(s) · avanza cada producto al terminar
        </p>
      </div>
      <div class="flex items-center gap-2 text-xs font-semibold text-cafe-500">
        <span class="rounded-full bg-crema-200 px-2 py-0.5 text-cafe-700">Pendiente</span>
        <span class="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">En preparación</span>
        <span class="rounded-full bg-green-100 px-2 py-0.5 text-green-800">Listo</span>
      </div>
    </div>

    <div
      v-if="pedidosActivos.length === 0"
      class="rounded-2xl border-2 border-dashed border-cafe-300/60 bg-white/60 p-12 text-center"
    >
      <p class="text-lg font-bold text-cafe-600">No hay pedidos pendientes</p>
      <p class="mt-1 text-sm text-cafe-400">
        Cuando el mesero envíe un pedido, aparecerá aquí automáticamente.
      </p>
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <article
        v-for="pedido in pedidosActivos"
        :key="pedido.id"
        class="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-suave"
        :class="
          datos.pedidoCompleto(pedido)
            ? 'border-green-300'
            : 'border-cafe-900/10'
        "
      >
        <header
          class="flex items-center justify-between px-5 py-3"
          :class="datos.pedidoCompleto(pedido) ? 'bg-green-100' : 'bg-cafe-700'"
        >
          <div>
            <p class="font-bold text-white">{{ datos.mesaPorId(pedido.mesaId).nombre }}</p>
            <p :class="datos.pedidoCompleto(pedido) ? 'text-green-700' : 'text-crema-100/80'" class="text-xs">
              Hace {{ formatearTiempo(pedido.creadoEn, ahora) }}
            </p>
          </div>
          <p
            class="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            :class="datos.pedidoCompleto(pedido) ? 'bg-green-700 text-white' : 'bg-crema-50/90 text-cafe-700'"
          >
            {{ datos.pedidoCompleto(pedido) ? 'Completo' : 'En cocina' }}
          </p>
        </header>

        <ul class="flex-1 divide-y divide-crema-100 px-5">
          <li
            v-for="(producto, indice) in pedido.productos"
            :key="indice"
            class="py-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold text-cafe-800">
                  <span class="text-cafe-400">{{ producto.cantidad }}×</span>
                  {{ producto.nombre }}
                </p>
                <p v-if="producto.nota" class="text-sm italic text-cafe-500">
                  Nota: {{ producto.nota }}
                </p>
              </div>
              <span
                class="flex-none rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                :class="clasesEstado[producto.estado]"
              >
                {{ ETIQUETAS_ESTADO[producto.estado] }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="text-sm text-cafe-500">{{ formatearPrecio(producto.precio * producto.cantidad) }}</span>
              <button
                v-if="producto.estado !== 'listo'"
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                :class="
                  producto.estado === 'en_preparacion'
                    ? 'bg-green-700 text-white hover:bg-green-800'
                    : 'bg-durazno-400 text-cafe-900 hover:bg-durazno-500'
                "
                @click="avanzar(pedido.id, indice)"
              >
                {{ etiquetasAccion[producto.estado] }}
              </button>
              <span
                v-else
                class="px-3 py-1.5 text-xs font-bold text-green-700"
              >
                {{ etiquetasAccion[producto.estado] }}
              </span>
            </div>
          </li>
        </ul>

        <footer
          v-if="datos.pedidoCompleto(pedido)"
          class="bg-green-100 px-5 py-3 text-center text-sm font-bold text-green-800"
        >
          Pedido completo: avísale al mesero.
        </footer>
      </article>
    </div>
  </div>
</template>