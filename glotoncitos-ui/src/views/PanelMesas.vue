<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import TarjetaMesa from '../components/TarjetaMesa.vue'
import ModalCrearPedido from '../components/ModalCrearPedido.vue'
import DetallePedido from '../components/DetallePedido.vue'

const datos = useDatosStore()

const pisoActivo = ref(1)
const modalCrear = ref(null)
const modalDetalle = ref(null)
const ahora = ref(Date.now())

let temporizador

onMounted(async () => {
  await datos.cargarDatos()
  temporizador = setInterval(() => {
    ahora.value = Date.now()
  }, 10000)
})

onBeforeUnmount(() => clearInterval(temporizador))

const mesasDelPiso = computed(() => datos.mesasPorPiso(pisoActivo.value))
const disponiblesDelPiso = computed(() => mesasDelPiso.value.filter((m) => m.estado === 'libre').length)
const sinAtenderDelPiso = computed(() => mesasDelPiso.value.filter((m) => m.estado === 'sin_atender').length)

const productoCompleto = (mesaId) => {
  const pedido = datos.pedidoDeMesa(mesaId)
  return pedido ? datos.pedidoCompleto(pedido) : false
}

function alSeleccionar(mesa) {
  if (mesa.estado === 'libre') {
    modalCrear.value = mesa
  } else {
    modalDetalle.value = mesa
  }
}

async function confirmarCreacion(items) {
  await datos.crearPedido(modalCrear.value.id, items)
  modalCrear.value = null
}
</script>

<template>
  <div class="pt-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Panel de Mesas</h1>
        <p class="text-sm text-cafe-500">
          {{ disponiblesDelPiso }} disponibles · {{ sinAtenderDelPiso }} sin atender en el piso seleccionado
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="flex items-center gap-1.5 text-xs font-semibold text-cafe-500">
          <span class="h-3 w-3 rounded-full border-2 border-green-300 bg-green-50"></span> Disponible / atendida
        </span>
        <span class="flex items-center gap-1.5 text-xs font-semibold text-cafe-500">
          <span class="h-3 w-3 rounded-full border-2 border-red-200 bg-red-50"></span> Sin atender
        </span>
      </div>
    </div>

    <div v-if="datos.cargando" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cafe-700"></div>
    </div>

    <div v-else-if="datos.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="text-sm">{{ datos.error }}</p>
      <button class="mt-2 rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50" @click="datos.cargarDatos">Reintentar</button>
    </div>

    <template v-else>
      <div class="mb-5 flex gap-2">
        <button
          v-for="piso in datos.pisos"
          :key="piso.id"
          type="button"
          class="rounded-xl px-5 py-2 text-sm font-bold transition-colors"
          :class="
            pisoActivo === piso.numero
              ? 'bg-cafe-700 text-crema-50 shadow'
              : 'border border-cafe-900/10 bg-white text-cafe-600 hover:bg-crema-200'
          "
          @click="pisoActivo = piso.numero"
        >
          Piso {{ piso.numero }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <TarjetaMesa
          v-for="mesa in mesasDelPiso"
          :key="mesa.id"
          :mesa="mesa"
          :ahora="ahora"
          @seleccionar="alSeleccionar"
        />
      </div>
    </template>

    <ModalCrearPedido
      v-if="modalCrear"
      :mesa="modalCrear"
      @confirmar="confirmarCreacion"
      @cerrar="modalCrear = null"
    />

    <div
      v-if="modalDetalle"
      class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
      @click.self="modalDetalle = null"
    >
      <div class="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-crema-50 shadow-2xl">
        <div class="flex items-center justify-between border-b border-crema-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-extrabold text-cafe-800">Pedido actual</h2>
            <p class="text-sm text-cafe-500">Detalle en tiempo real de {{ modalDetalle.nombre }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg px-3 py-1 text-sm font-semibold text-cafe-500 transition-colors hover:bg-crema-200 hover:text-cafe-800"
            @click="modalDetalle = null"
          >
            Cerrar
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <p
            v-if="productoCompleto(modalDetalle.id)"
            class="mb-4 rounded-xl bg-green-100 px-4 py-3 text-sm font-bold text-green-800"
          >
            Todos los productos están listos. ¡Se puede servir!
          </p>
          <DetallePedido
            :pedido="datos.pedidoDeMesa(modalDetalle.id)"
            :mesa="modalDetalle"
          />
        </div>

        <div class="border-t border-crema-200 bg-crema-100 px-6 py-4">
          <button
            type="button"
            class="w-full rounded-lg border border-cafe-700/25 bg-white px-4 py-2 text-sm font-semibold text-cafe-700 transition-colors hover:bg-crema-200"
            @click="modalDetalle = null"
          >
            Volver a las mesas
          </button>
        </div>
      </div>
    </div>
  </div>
</template>