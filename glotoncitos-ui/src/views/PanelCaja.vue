<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import DetallePedido from '../components/DetallePedido.vue'
import { formatearPrecio, formatearTiempo } from '../utils/formato'

const datos = useDatosStore()

const mesaSeleccionada = ref(null)
const confirmandoPago = ref(false)
const ahora = ref(Date.now())

let temporizador

onMounted(async () => {
  await datos.cargarDatos()
  temporizador = setInterval(() => {
    ahora.value = Date.now()
  }, 10000)
})

onBeforeUnmount(() => clearInterval(temporizador))

const ocupadas = computed(() => datos.mesasOcupadas)

const pedidoSeleccionado = computed(() =>
  mesaSeleccionada.value ? datos.pedidoDeMesa(mesaSeleccionada.value.id) : null,
)

const totalSeleccionado = computed(() =>
  mesaSeleccionada.value ? datos.totalDeMesa(mesaSeleccionada.value.id) : 0,
)

function seleccionar(mesa) {
  mesaSeleccionada.value = mesa
  confirmandoPago.value = false
}

async function registrarPago() {
  if (!pedidoSeleccionado.value) return
  await datos.registrarPago(pedidoSeleccionado.value.id)
  mesaSeleccionada.value = null
  confirmandoPago.value = false
}
</script>

<template>
  <div class="pt-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Panel de Caja</h1>
        <p class="text-sm text-cafe-500">Cuentas abiertas y cierre de pagos del día</p>
      </div>
      <div class="rounded-xl border border-cafe-900/10 bg-white px-5 py-3 text-right shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-wide text-cafe-500">Ventas del día</p>
        <p class="text-2xl font-extrabold text-cafe-800">{{ formatearPrecio(datos.ventasDelDia) }}</p>
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
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <section class="rounded-2xl border border-cafe-900/10 bg-white p-4 shadow-sm">
          <h2 class="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-cafe-500">
            Mesas ocupadas ({{ ocupadas.length }})
          </h2>
          <div v-if="ocupadas.length === 0" class="rounded-xl border-2 border-dashed border-cafe-300/60 p-6 text-center">
            <p class="text-sm font-bold text-cafe-600">No hay mesas ocupadas</p>
            <p class="mt-1 text-xs text-cafe-400">Las mesas con cuenta abierta aparecerán aquí.</p>
          </div>
          <ul v-else class="space-y-2">
            <li v-for="mesa in ocupadas" :key="mesa.id">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors"
                :class="
                  mesaSeleccionada?.id === mesa.id
                    ? 'border-cafe-700 bg-cafe-700 text-crema-50'
                    : 'border-cafe-900/10 bg-crema-50 hover:border-durazno-400'
                "
                @click="seleccionar(mesa)"
              >
                <div>
                  <p class="font-bold">{{ mesa.nombre }}</p>
                  <p :class="mesaSeleccionada?.id === mesa.id ? 'text-crema-100/80' : 'text-cafe-500'" class="text-xs">
                    Piso {{ mesa.piso }} · hace {{ formatearTiempo(mesa.ocupadaDesde, ahora) }}
                  </p>
                </div>
                <span class="text-sm font-bold">{{ formatearPrecio(datos.totalDeMesa(mesa.id)) }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm">
          <template v-if="pedidoSeleccionado && mesaSeleccionada">
            <div class="mb-4">
              <h2 class="text-xl font-extrabold text-cafe-800">Cuenta de {{ mesaSeleccionada.nombre }}</h2>
              <p class="text-sm text-cafe-500">Revisa el detalle antes de cerrar el pago</p>
            </div>
            <DetallePedido :pedido="pedidoSeleccionado" :mesa="mesaSeleccionada" :mostrar-estado="false" />

            <div class="mt-5 flex flex-col items-end gap-3">
              <div v-if="!confirmandoPago" class="flex items-center gap-3">
                <button
                  type="button"
                  class="rounded-xl bg-cafe-700 px-5 py-2.5 text-sm font-bold text-crema-50 transition-colors hover:bg-cafe-800"
                  @click="confirmandoPago = true"
                >
                  Registrar pago y liberar mesa
                </button>
              </div>
              <div v-else class="flex w-full flex-col items-end gap-2 rounded-xl bg-green-100 p-4">
                <p class="text-sm font-bold text-green-800">
                  ¿Confirmar el pago de {{ formatearPrecio(totalSeleccionado) }} y liberar
                  {{ mesaSeleccionada.nombre }}?
                </p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-cafe-700/25 bg-white px-4 py-2 text-sm font-semibold text-cafe-700 transition-colors hover:bg-crema-200"
                    @click="confirmandoPago = false"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-800"
                    @click="registrarPago"
                  >
                    Confirmar pago
                  </button>
                </div>
              </div>
            </div>
          </template>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cafe-300/60 px-6 py-16 text-center"
          >
            <p class="text-lg font-bold text-cafe-600">Selecciona una mesa ocupada</p>
            <p class="text-sm text-cafe-400">
              Verás el detalle del pedido y podrás registrar el pago para liberar la mesa.
            </p>
          </div>
        </section>
      </div>

      <section class="mt-8">
        <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-cafe-500">Pagos recientes</h2>
        <ul class="overflow-hidden rounded-2xl border border-cafe-900/10 bg-white shadow-sm">
          <li
            v-for="(pago, indice) in datos.pedidosCerrados"
            :key="indice"
            class="flex flex-wrap items-center justify-between gap-2 border-b border-crema-100 px-5 py-3 text-sm last:border-b-0"
          >
            <div class="flex items-center gap-3">
              <span class="font-bold text-cafe-800">{{ pago.mesaNombre }}</span>
              <span class="text-cafe-500">
                {{ pago.productos.length }} ítem(s) · hace {{ formatearTiempo(pago.pagadoEn, ahora) }}
              </span>
            </div>
            <span class="font-bold text-green-700">{{ formatearPrecio(pago.total) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>