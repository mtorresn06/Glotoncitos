<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDatosStore } from '../stores/datos'
import DetallePedido from '../components/DetallePedido.vue'
import { formatearPrecio, formatearTiempo } from '../utils/formato'

const datos = useDatosStore()

const pisoActivo = ref(1)
const mesaSeleccionada = ref(null)
const metodoPago = ref('efectivo')
const guardando = ref(false)
const errorCaja = ref('')
const ahora = computed(() => datos.reloj)

const METODOS = [
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'qr', etiqueta: 'QR' },
  { id: 'datafono', etiqueta: 'Datafono' },
]

const ETIQUETAS_METODO = {
  efectivo: 'Efectivo',
  qr: 'QR',
  datafono: 'Datafono',
  transferencia: 'Transferencia',
}

let temporizador

onMounted(async () => {
  await datos.cargarCaja(datos.fechaPagos)
  if (pisoActivo.value === 1 && datos.pisos[0]) pisoActivo.value = datos.pisos[0].numero
  datos.iniciarReloj()
  temporizador = setInterval(async () => {
    try {
      await datos.cargarCaja(datos.fechaPagos)
    } catch {
      return
    }
  }, 10000)
})

onBeforeUnmount(() => {
  clearInterval(temporizador)
  datos.detenerReloj()
})

watch(
  () => datos.fechaPagos,
  (fecha) => datos.cargarCaja(fecha),
)

const mesasConCuenta = computed(() => datos.mesasConCuenta)
const mesasDelPiso = computed(() => mesasConCuenta.value.filter((mesa) => mesa.piso === pisoActivo.value))
const totalPendiente = computed(() =>
  mesasConCuenta.value.reduce((suma, mesa) => suma + datos.totalDeMesa(mesa.id), 0),
)

const pedidoSeleccionado = computed(() =>
  mesaSeleccionada.value ? datos.pedidoDeMesa(mesaSeleccionada.value.id) : null,
)

const totalSeleccionado = computed(() =>
  mesaSeleccionada.value ? datos.totalDeMesa(mesaSeleccionada.value.id) : 0,
)

const puedeCobrar = computed(
  () => Boolean(pedidoSeleccionado.value) && pedidoSeleccionado.value.estado === 'listo'
    && mesaSeleccionada.value?.estado === 'atendida',
)

function etiquetaCuenta(mesa) {
  const pedido = datos.pedidoDeMesa(mesa.id)
  if (pedido?.estado === 'listo' && mesa.estado === 'atendida') return 'Lista para cobrar'
  if (pedido?.estado === 'listo') return 'Esperando al mesero'
  return 'En preparación'
}

function clasesCuenta(mesa) {
  const etiqueta = etiquetaCuenta(mesa)
  if (etiqueta === 'Lista para cobrar') return 'border-green-300 bg-green-50'
  if (etiqueta === 'Esperando al mesero') return 'border-amber-300 bg-amber-50'
  return 'border-cafe-900/10 bg-white'
}

function abrirCuenta(mesa) {
  mesaSeleccionada.value = mesa
  metodoPago.value = 'efectivo'
  errorCaja.value = ''
}

async function confirmarPago() {
  if (!puedeCobrar.value || guardando.value) return
  guardando.value = true
  errorCaja.value = ''
  try {
    await datos.registrarPago(pedidoSeleccionado.value.id, metodoPago.value)
    mesaSeleccionada.value = null
  } catch (error) {
    errorCaja.value = error.message || 'No se pudo registrar el pago'
  } finally {
    guardando.value = false
  }
}

async function cancelarPago(pago) {
  const confirmado = window.confirm(
    `¿Cancelar el pago de ${formatearPrecio(pago.total)} de la mesa ${pago.mesaNombre}? La cuenta vuelve a abrirse.`,
  )
  if (!confirmado) return
  guardando.value = true
  errorCaja.value = ''
  try {
    await datos.revertirPago(pago.id)
  } catch (error) {
    errorCaja.value = error.message || 'No se pudo cancelar el pago'
  } finally {
    guardando.value = false
  }
}

function hora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="pt-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Panel de Caja</h1>
        <p class="text-sm text-cafe-500">
          {{ mesasConCuenta.length }} cuenta(s) abierta(s) · {{ formatearPrecio(totalPendiente) }} por cobrar
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs font-bold uppercase tracking-wide text-cafe-500" for="fecha-caja">Historial del día</label>
        <input
          id="fecha-caja"
          v-model="datos.fechaPagos"
          type="date"
          class="rounded-lg border border-cafe-300 bg-white px-3 py-2 text-sm text-cafe-800"
        />
        <div class="rounded-xl border border-cafe-900/10 bg-white px-5 py-2 text-right shadow-sm">
          <p class="text-xs font-semibold uppercase tracking-wide text-cafe-500">Cobrado</p>
          <p class="text-xl font-extrabold text-cafe-800">{{ formatearPrecio(datos.totalCobradoDia) }}</p>
        </div>
      </div>
    </div>

    <p v-if="errorCaja" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ errorCaja }}
    </p>

    <div v-if="datos.cargando && mesasConCuenta.length === 0" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cafe-700"></div>
    </div>

    <div v-else-if="datos.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="text-sm">{{ datos.error }}</p>
      <button class="mt-2 rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50" @click="datos.cargarCaja(datos.fechaPagos)">Reintentar</button>
    </div>

    <template v-else>
      <div class="mb-5 flex flex-wrap gap-2">
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

      <div v-if="mesasDelPiso.length === 0" class="rounded-2xl border-2 border-dashed border-cafe-300/60 bg-white/60 p-12 text-center">
        <p class="text-lg font-bold text-cafe-600">No hay cuentas abiertas en este piso</p>
        <p class="mt-1 text-sm text-cafe-400">Las mesas con pedido aparecerán aquí automáticamente.</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="mesa in mesasDelPiso"
          :key="mesa.id"
          type="button"
          class="flex flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-suave"
          :class="clasesCuenta(mesa)"
          @click="abrirCuenta(mesa)"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-lg font-bold text-cafe-800">{{ mesa.nombre }}</p>
              <p class="text-xs text-cafe-500">Piso {{ mesa.piso }} · {{ mesa.ocupadaPersonas || '-' }} persona(s)</p>
            </div>
            <span class="text-xs font-bold uppercase tracking-wide" :class="etiquetaCuenta(mesa) === 'Lista para cobrar' ? 'text-green-700' : 'text-cafe-500'">
              {{ etiquetaCuenta(mesa) }}
            </span>
          </div>
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-semibold text-cafe-500">
              {{ formatearTiempo(mesa.ocupadaDesde, ahora) }}
            </span>
            <span class="font-extrabold text-cafe-800">{{ formatearPrecio(datos.totalDeMesa(mesa.id)) }}</span>
          </div>
        </button>
      </div>

      <section class="mt-8">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-bold uppercase tracking-wide text-cafe-500">
            Historial de pagos ({{ datos.pagosDelDia.length }})
          </h2>
          <div class="flex flex-wrap gap-2 text-xs font-bold text-cafe-600">
            <span
              v-for="(total, metodo) in datos.totalesPorMetodo"
              :key="metodo"
              class="rounded-full bg-crema-200 px-3 py-1"
            >
              {{ ETIQUETAS_METODO[metodo] || metodo }}: {{ formatearPrecio(total) }}
            </span>
          </div>
        </div>

        <ul v-if="datos.pagos.length > 0" class="overflow-hidden rounded-2xl border border-cafe-900/10 bg-white shadow-sm">
          <li
            v-for="pago in datos.pagos"
            :key="pago.id"
            class="flex flex-wrap items-center justify-between gap-2 border-b border-crema-100 px-5 py-3 text-sm last:border-b-0"
          >
            <div class="flex flex-wrap items-center gap-3">
              <span class="font-bold text-cafe-800">{{ hora(pago.fecha) }}</span>
              <span class="font-semibold text-cafe-700">Mesa {{ pago.mesaNombre }}</span>
              <span class="rounded-full bg-crema-200 px-2 py-0.5 text-xs font-bold text-cafe-700">
                {{ ETIQUETAS_METODO[pago.metodo] || pago.metodo }}
              </span>
              <span v-if="pago.estado === 'revertido'" class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                Revertido
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-extrabold" :class="pago.estado === 'revertido' ? 'text-cafe-400 line-through' : 'text-green-700'">
                {{ formatearPrecio(pago.total) }}
              </span>
              <button
                v-if="pago.estado === 'pagado'"
                type="button"
                :disabled="guardando"
                class="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                @click="cancelarPago(pago)"
              >
                Cancelar pago
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="rounded-2xl border-2 border-dashed border-cafe-300/60 bg-white/60 p-8 text-center text-sm text-cafe-500">
          No hay pagos registrados en el día seleccionado.
        </p>
      </section>
    </template>

    <div
      v-if="mesaSeleccionada"
      class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
      @click.self="mesaSeleccionada = null"
    >
      <div class="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-crema-50 shadow-2xl">
        <div class="flex items-center justify-between border-b border-crema-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-extrabold text-cafe-800">Cuenta de la mesa {{ mesaSeleccionada.nombre }}</h2>
            <p class="text-sm text-cafe-500">
              Piso {{ mesaSeleccionada.piso }} · abierta hace {{ formatearTiempo(mesaSeleccionada.ocupadaDesde, ahora) }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg px-3 py-1 text-sm font-semibold text-cafe-500 transition-colors hover:bg-crema-200 hover:text-cafe-800"
            @click="mesaSeleccionada = null"
          >
            Cerrar
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <template v-if="pedidoSeleccionado">
            <p
              v-if="!puedeCobrar"
              class="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900"
            >
              {{ etiquetaCuenta(mesaSeleccionada) }}. Solo puedes cobrar mesas atendidas con la orden lista.
            </p>
            <DetallePedido
              :pedido="pedidoSeleccionado"
              :mesa="mesaSeleccionada"
              :mostrar-estado="false"
            />
            <p v-if="errorCaja" class="mt-3 text-sm text-red-700">{{ errorCaja }}</p>
          </template>
          <p v-else class="rounded-xl border border-dashed border-cafe-300 p-6 text-center text-sm text-cafe-500">
            Esta mesa no tiene una cuenta abierta.
          </p>
        </div>

        <div v-if="pedidoSeleccionado" class="border-t border-crema-200 bg-crema-100 px-6 py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label class="mb-1 block text-xs font-bold uppercase tracking-wide text-cafe-500" for="metodo-pago">
                Método de pago
              </label>
              <select
                id="metodo-pago"
                v-model="metodoPago"
                class="w-44 rounded-lg border border-cafe-300 bg-white px-3 py-2 text-sm font-semibold text-cafe-800"
              >
                <option v-for="metodo in METODOS" :key="metodo.id" :value="metodo.id">
                  {{ metodo.etiqueta }}
                </option>
              </select>
            </div>
            <div class="text-right">
              <p class="text-xs font-bold uppercase tracking-wide text-cafe-500">Total a cobrar</p>
              <p class="text-2xl font-extrabold text-cafe-800">{{ formatearPrecio(totalSeleccionado) }}</p>
            </div>
          </div>
          <button
            type="button"
            :disabled="!puedeCobrar || guardando"
            class="mt-4 w-full rounded-xl bg-cafe-700 px-4 py-3 text-sm font-extrabold text-crema-50 transition-colors hover:bg-cafe-800 disabled:opacity-50"
            @click="confirmarPago"
          >
            {{ guardando ? 'Registrando...' : 'Confirmar pago' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
