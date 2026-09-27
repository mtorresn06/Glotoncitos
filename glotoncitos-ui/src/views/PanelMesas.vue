<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import { useSesionStore } from '../stores/sesion'
import TarjetaMesa from '../components/TarjetaMesa.vue'
import ModalCrearPedido from '../components/ModalCrearPedido.vue'
import DetallePedido from '../components/DetallePedido.vue'
import { formatearPrecio } from '../utils/formato'

const datos = useDatosStore()
const sesion = useSesionStore()

const pisoActivo = ref(1)
const modalCrear = ref(null)
const modalDetalle = ref(null)
const agregandoAlPedido = ref(false)
const modalPiso = ref(false)
const modalMesa = ref(false)
const nuevoPiso = ref('')
const nuevaMesa = reactive({ numero: '', capacidad: '', idPiso: '' })
const errorGestion = ref('')
const numeroMesa = ref('')
const guardandoMesa = ref(false)
const guardando = ref(false)
const guardandoCancelacion = ref(false)
const guardandoCambio = ref(false)
const modalCambioMesa = ref(false)
const mesaDestinoId = ref('')
const errorPedido = ref('')
const esAdmin = computed(() => sesion.rolId === 'administrador')
const esMesero = computed(() => sesion.rolId === 'mesero')
const ahora = computed(() => datos.reloj)
let consulta
let ultimoAviso = 0

function reproducirAviso() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const contexto = new AudioContext()
    const oscilador = contexto.createOscillator()
    const volumen = contexto.createGain()
    oscilador.frequency.value = 880
    volumen.gain.value = 0.08
    oscilador.connect(volumen)
    volumen.connect(contexto.destination)
    oscilador.start()
    oscilador.stop(contexto.currentTime + 0.25)
  } catch {
    return
  }
}

onMounted(async () => {
  await datos.cargarDatos()
  ultimoAviso = datos.mesas.filter((mesa) => mesa.pedidoListo && mesa.estado === 'sin_atender').length
  datos.iniciarReloj()
  consulta = setInterval(async () => {
    try {
      await datos.cargarMesas()
      if (!esMesero.value) return
      const nuevosAvisos = datos.mesas.filter((mesa) => mesa.pedidoListo && mesa.estado === 'sin_atender').length
      if (nuevosAvisos > ultimoAviso) reproducirAviso()
      ultimoAviso = nuevosAvisos
    } catch {
      return
    }
  }, 5000)
})

onBeforeUnmount(() => {
  clearInterval(consulta)
  datos.detenerReloj()
})

const mesasDelPiso = computed(() => datos.mesasPorPiso(pisoActivo.value))
const mesasDelPisoPorNumero = (numero) => datos.mesasPorPiso(numero)
const disponiblesDelPiso = computed(() => mesasDelPiso.value.filter((m) => m.estado === 'libre').length)
const sinAtenderDelPiso = computed(() => mesasDelPiso.value.filter((m) => m.estado === 'sin_atender').length)
const mesasListas = computed(() =>
  datos.mesas.filter((mesa) => mesa.pedidoListo && mesa.estado === 'sin_atender'),
)

const productoCompleto = (mesaId) => {
  const pedido = datos.pedidoDeMesa(mesaId)
  return pedido ? datos.pedidoCompleto(pedido) : false
}

function alSeleccionar(mesa) {
  if (esAdmin.value) {
    modalDetalle.value = mesa
    numeroMesa.value = String(mesa.nombre)
    errorGestion.value = ''
    return
  }

  errorPedido.value = ''
  if (mesa.estado === 'reservada') {
    errorPedido.value = 'Esta mesa está reservada.'
    return
  }

  if (datos.pedidoDeMesa(mesa.id)) {
    modalDetalle.value = mesa
    return
  }

  modalCrear.value = mesa
}

function abrirAgregarPlatos() {
  agregandoAlPedido.value = true
  modalCrear.value = modalDetalle.value
}

function cerrarOrden() {
  modalCrear.value = null
  agregandoAlPedido.value = false
}

async function aceptarMesaAtendida(mesa) {
  errorPedido.value = ''
  try {
    await datos.cambiarEstadoMesa(mesa.id, 'atendida')
    if (modalDetalle.value?.id === mesa.id) modalDetalle.value = datos.mesaPorId(mesa.id)
  } catch (error) {
    errorPedido.value = error.message || 'No se pudo marcar la mesa como atendida'
  }
}

const mesasLibresDestino = computed(() => datos.mesasLibres.filter((mesa) => mesa.id !== modalDetalle.value?.id))

function abrirCambioMesa() {
  errorPedido.value = ''
  mesaDestinoId.value = ''
  modalCambioMesa.value = true
}

async function confirmarCambioMesa() {
  if (!mesaDestinoId.value) return
  errorPedido.value = ''
  guardandoCambio.value = true
  try {
    const mesa = await datos.cambiarMesa(modalDetalle.value.id, mesaDestinoId.value)
    modalCambioMesa.value = false
    pisoActivo.value = mesa.piso
    modalDetalle.value = null
  } catch (error) {
    errorPedido.value = error.message || 'No se pudo cambiar la orden de mesa'
  } finally {
    guardandoCambio.value = false
  }
}

async function cancelarMesaActual() {
  const mesa = modalDetalle.value
  const confirmado = window.confirm(
    `¿Cancelar la mesa ${mesa.nombre}? La orden actual se cancela y la mesa queda disponible.`,
  )
  if (!confirmado) return
  errorPedido.value = ''
  guardandoCancelacion.value = true
  try {
    await datos.cancelarMesa(mesa.id)
    modalDetalle.value = null
  } catch (error) {
    errorPedido.value = error.message || 'No se pudo cancelar la mesa'
  } finally {
    guardandoCancelacion.value = false
  }
}

async function eliminarMesaActual() {
  const mesa = modalDetalle.value
  const confirmado = window.confirm(`¿Eliminar la mesa ${mesa.nombre}? Esta acción no se puede deshacer.`)
  if (!confirmado) return
  errorGestion.value = ''
  guardando.value = true
  try {
    await datos.eliminarMesa(mesa.id)
    modalDetalle.value = null
  } catch (error) {
    errorGestion.value = error.message || 'No se pudo eliminar la mesa'
  } finally {
    guardando.value = false
  }
}

async function eliminarPisoActual(piso) {
  const mesas = mesasDelPisoPorNumero(piso.numero)
  if (mesas.length > 0) {
    errorGestion.value = `El piso ${piso.numero} tiene ${mesas.length} mesa(s); elimínalas antes de eliminar el piso`
    return
  }
  const confirmado = window.confirm(`¿Eliminar el piso ${piso.numero}?`)
  if (!confirmado) return
  errorGestion.value = ''
  guardando.value = true
  try {
    await datos.eliminarPiso(piso.id)
    if (pisoActivo.value === piso.numero) pisoActivo.value = datos.pisos[0]?.numero || 1
  } catch (error) {
    errorGestion.value = error.message || 'No se pudo eliminar el piso'
  } finally {
    guardando.value = false
  }
}

async function guardarNumeroMesa() {
  errorGestion.value = ''
  guardandoMesa.value = true
  try {
    await datos.actualizarMesa(modalDetalle.value.id, { numero: Number(numeroMesa.value) })
    modalDetalle.value = null
  } catch (error) {
    errorGestion.value = error.message || 'No se pudo actualizar el número de mesa'
  } finally {
    guardandoMesa.value = false
  }
}

async function confirmarCreacion({ items, personas }) {
  errorPedido.value = ''
  try {
    if (agregandoAlPedido.value) {
      const pedido = datos.pedidoDeMesa(modalCrear.value.id)
      if (!pedido) throw new Error('La mesa no tiene una orden activa')
      await datos.agregarProductosPedido(pedido.id, items)
    } else {
      await datos.crearPedido(modalCrear.value.id, items, personas)
    }
    modalCrear.value = null
    agregandoAlPedido.value = false
  } catch (error) {
    errorPedido.value = error.message || 'No se pudo guardar la orden'
  }
}

async function guardarPiso() {
  errorGestion.value = ''
  guardando.value = true
  try {
    const piso = await datos.crearPiso(Number(nuevoPiso.value))
    pisoActivo.value = piso.numero
    nuevoPiso.value = ''
    modalPiso.value = false
  } catch (error) {
    errorGestion.value = error.message || 'No se pudo crear el piso'
  } finally {
    guardando.value = false
  }
}

function abrirMesa() {
  nuevaMesa.numero = ''
  nuevaMesa.capacidad = ''
  nuevaMesa.idPiso = datos.pisos.find((piso) => piso.numero === pisoActivo.value)?.id || datos.pisos[0]?.id || ''
  errorGestion.value = ''
  modalMesa.value = true
}

async function guardarMesa() {
  errorGestion.value = ''
  guardando.value = true
  try {
    const mesa = await datos.crearMesa({
      numero: Number(nuevaMesa.numero),
      capacidad: Number(nuevaMesa.capacidad),
      idPiso: nuevaMesa.idPiso,
    })
    pisoActivo.value = mesa.piso
    modalMesa.value = false
  } catch (error) {
    errorGestion.value = error.message || 'No se pudo crear la mesa'
  } finally {
    guardando.value = false
  }
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
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="esAdmin"
          type="button"
          class="rounded-lg border border-cafe-700/25 bg-white px-3 py-2 text-xs font-bold text-cafe-700 hover:bg-crema-200"
          @click="nuevoPiso = ''; modalPiso = true"
        >
          + Crear piso
        </button>
        <button
          v-if="esAdmin"
          type="button"
          class="rounded-lg bg-cafe-700 px-3 py-2 text-xs font-bold text-crema-50 hover:bg-cafe-800"
          @click="abrirMesa"
        >
          + Crear mesa
        </button>
        <span class="flex items-center gap-1.5 text-xs font-semibold text-cafe-500">
          <span class="h-3 w-3 rounded-full bg-green-300"></span> Disponible / atendida
        </span>
        <span class="flex items-center gap-1.5 text-xs font-semibold text-cafe-500">
          <span class="h-3 w-3 rounded-full bg-red-300"></span> Sin atender
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
      <div
        v-if="esMesero && mesasListas.length > 0"
        class="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-extrabold text-amber-900">Comida lista</p>
            <p class="text-sm text-amber-800">
              {{ mesasListas.length }} mesa(s) esperando aceptación: {{ mesasListas.map((mesa) => mesa.nombre).join(', ') }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="mesa in mesasListas"
              :key="mesa.id"
              type="button"
              class="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
              @click="aceptarMesaAtendida(mesa)"
            >
              Mesa {{ mesa.nombre }} · {{ formatearPrecio(datos.totalDeMesa(mesa.id)) }} · atendida
            </button>
          </div>
        </div>
      </div>

      <p v-if="errorPedido" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ errorPedido }}
      </p>

      <div class="mb-5 flex flex-wrap gap-2">
        <div v-for="piso in datos.pisos" :key="piso.id" class="flex items-center gap-1">
          <button
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
          <button
            v-if="esAdmin"
            type="button"
            :title="mesasDelPisoPorNumero(piso.numero).length > 0 ? 'El piso tiene mesas' : 'Eliminar piso'"
            :disabled="mesasDelPisoPorNumero(piso.numero).length > 0"
            class="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:border-crema-200 disabled:bg-crema-100 disabled:text-cafe-300"
            @click="eliminarPisoActual(piso)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <TarjetaMesa
          v-for="mesa in mesasDelPiso"
          :key="mesa.id"
          :mesa="mesa"
          :ahora="ahora"
          :modo-admin="esAdmin"
          @seleccionar="alSeleccionar"
        />
      </div>
    </template>

    <ModalCrearPedido
      v-if="modalCrear"
      :mesa="modalCrear"
      :agregando="agregandoAlPedido"
      @confirmar="confirmarCreacion"
      @cerrar="cerrarOrden"
    />

    <div
      v-if="modalPiso"
      class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
      @click.self="modalPiso = false"
    >
      <form class="w-full max-w-md rounded-2xl bg-crema-50 p-6 shadow-2xl" @submit.prevent="guardarPiso">
        <h2 class="text-xl font-extrabold text-cafe-800">Crear piso</h2>
        <label class="mt-4 block text-sm font-semibold text-cafe-700" for="nuevo-piso">Número de piso</label>
        <input id="nuevo-piso" v-model="nuevoPiso" type="number" min="1" required class="mt-1 w-full rounded-lg border border-cafe-300 bg-white px-3 py-2" />
        <p v-if="errorGestion" class="mt-3 text-sm text-red-700">{{ errorGestion }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-cafe-600" @click="modalPiso = false">Cancelar</button>
          <button type="submit" :disabled="guardando" class="rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 disabled:opacity-50">{{ guardando ? 'Guardando...' : 'Crear piso' }}</button>
        </div>
      </form>
    </div>

    <div
      v-if="modalMesa"
      class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
      @click.self="modalMesa = false"
    >
      <form class="w-full max-w-md rounded-2xl bg-crema-50 p-6 shadow-2xl" @submit.prevent="guardarMesa">
        <h2 class="text-xl font-extrabold text-cafe-800">Crear mesa</h2>
        <label class="mt-4 block text-sm font-semibold text-cafe-700" for="nueva-mesa">Número de mesa</label>
        <input id="nueva-mesa" v-model="nuevaMesa.numero" type="number" min="1" required class="mt-1 w-full rounded-lg border border-cafe-300 bg-white px-3 py-2" />
        <label class="mt-3 block text-sm font-semibold text-cafe-700" for="capacidad-mesa">Capacidad</label>
        <input id="capacidad-mesa" v-model="nuevaMesa.capacidad" type="number" min="1" required class="mt-1 w-full rounded-lg border border-cafe-300 bg-white px-3 py-2" />
        <label class="mt-3 block text-sm font-semibold text-cafe-700" for="piso-mesa">Piso</label>
        <select id="piso-mesa" v-model="nuevaMesa.idPiso" required class="mt-1 w-full rounded-lg border border-cafe-300 bg-white px-3 py-2">
          <option v-for="piso in datos.pisos" :key="piso.id" :value="piso.id">Piso {{ piso.numero }}</option>
        </select>
        <p v-if="errorGestion" class="mt-3 text-sm text-red-700">{{ errorGestion }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-cafe-600" @click="modalMesa = false">Cancelar</button>
          <button type="submit" :disabled="guardando" class="rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 disabled:opacity-50">{{ guardando ? 'Guardando...' : 'Crear mesa' }}</button>
        </div>
      </form>
    </div>

    <div
      v-if="modalCambioMesa && modalDetalle"
      class="fixed inset-0 z-50 flex items-center justify-center bg-cafe-900/60 p-4"
      @click.self="modalCambioMesa = false"
    >
      <form class="w-full max-w-md rounded-2xl bg-crema-50 p-6 shadow-2xl" @submit.prevent="confirmarCambioMesa">
        <h2 class="text-xl font-extrabold text-cafe-800">Cambiar orden de mesa</h2>
        <p class="mt-1 text-sm text-cafe-500">
          La orden de la mesa {{ modalDetalle.nombre }} pasa completa a otra mesa disponible.
        </p>

        <template v-if="mesasLibresDestino.length > 0">
          <div class="mt-4 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
            <button
              v-for="mesa in mesasLibresDestino"
              :key="mesa.id"
              type="button"
              class="rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors"
              :class="
                mesaDestinoId === mesa.id
                  ? 'border-cafe-700 bg-cafe-700 text-crema-50'
                  : 'border-cafe-300 bg-white text-cafe-700 hover:bg-crema-200'
              "
              @click="mesaDestinoId = mesa.id"
            >
              Mesa {{ mesa.nombre }}
              <span class="block text-xs font-medium opacity-80">Piso {{ mesa.piso }} · {{ mesa.capacidad }} personas</span>
            </button>
          </div>
        </template>
        <p v-else class="mt-4 rounded-xl border border-dashed border-cafe-300 p-4 text-center text-sm text-cafe-500">
          No hay mesas disponibles en este momento.
        </p>

        <p v-if="errorPedido" class="mt-3 text-sm text-red-700">{{ errorPedido }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-semibold text-cafe-600" @click="modalCambioMesa = false">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="!mesaDestinoId || guardandoCambio"
            class="rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 disabled:opacity-50"
          >
            {{ guardandoCambio ? 'Moviendo...' : 'Mover orden' }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="modalDetalle"
      class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
      @click.self="modalDetalle = null"
    >
      <div class="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-crema-50 shadow-2xl">
        <div class="flex items-center justify-between border-b border-crema-200 px-6 py-4">
          <div>
            <h2 class="text-xl font-extrabold text-cafe-800">
              {{ esAdmin ? `Mesa ${modalDetalle.nombre}` : 'Pedido actual' }}
            </h2>
            <p class="text-sm text-cafe-500">
              {{ esAdmin ? `Piso ${modalDetalle.piso} · Pedido en solo lectura` : `Detalle en tiempo real de ${modalDetalle.nombre}` }}
            </p>
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
          <form v-if="esAdmin" class="mb-5 rounded-2xl border border-cafe-900/10 bg-white p-4" @submit.prevent="guardarNumeroMesa">
            <label class="block text-sm font-bold text-cafe-700" for="numero-mesa">Número de la mesa</label>
            <div class="mt-2 flex gap-2">
              <input
                id="numero-mesa"
                v-model="numeroMesa"
                type="number"
                min="1"
                required
                class="w-32 rounded-lg border border-cafe-300 bg-crema-50 px-3 py-2 text-cafe-800"
              />
              <button
                type="submit"
                :disabled="guardandoMesa"
                class="rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 transition-colors hover:bg-cafe-800 disabled:opacity-50"
              >
                {{ guardandoMesa ? 'Guardando...' : 'Guardar número' }}
              </button>
            </div>
            <div class="mt-3 border-t border-crema-100 pt-3">
              <button
                type="button"
                :disabled="guardando"
                class="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                @click="eliminarMesaActual"
              >
                {{ guardando ? 'Eliminando...' : 'Eliminar mesa' }}
              </button>
              <p v-if="datos.pedidoDeMesa(modalDetalle.id)" class="mt-2 text-xs text-cafe-500">
                La mesa tiene una cuenta abierta: primero cobra o cancela la mesa.
              </p>
            </div>
            <p v-if="errorGestion" class="mt-2 text-sm text-red-700">{{ errorGestion }}</p>
          </form>

          <template v-if="datos.pedidoDeMesa(modalDetalle.id)">
            <div
              v-if="esMesero && modalDetalle.pedidoListo && modalDetalle.estado === 'sin_atender'"
              class="mb-4 rounded-xl bg-amber-100 px-4 py-3"
            >
              <p class="font-bold text-amber-900">La cocina dice que la comida está lista.</p>
              <div class="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800"
                  @click="aceptarMesaAtendida(modalDetalle)"
                >
                  Aceptar mesa atendida
                </button>
                <span class="text-sm font-bold text-amber-900">
                  Total: {{ formatearPrecio(datos.totalDeMesa(modalDetalle.id)) }}
                </span>
              </div>
            </div>
            <p
              v-if="esAdmin"
              class="mb-4 rounded-xl bg-cafe-100 px-4 py-3 text-sm font-semibold text-cafe-700"
            >
              Como administrador solo puedes consultar el pedido; no se puede editar ni enviar a cocina.
            </p>
            <p
              v-else-if="productoCompleto(modalDetalle.id)"
              class="mb-4 rounded-xl bg-green-100 px-4 py-3 text-sm font-bold text-green-800"
            >
              Todos los productos están listos. ¡Se puede servir!
            </p>
            <DetallePedido
              :pedido="datos.pedidoDeMesa(modalDetalle.id)"
              :mesa="modalDetalle"
              :mostrar-estado="!esAdmin"
            />
          </template>
          <p v-else class="rounded-xl border border-dashed border-cafe-300 p-6 text-center text-sm text-cafe-500">
            Esta mesa no tiene un pedido activo.
          </p>
        </div>

        <div class="flex flex-wrap gap-2 border-t border-crema-200 bg-crema-100 px-6 py-4">
          <button
            v-if="esMesero && datos.pedidoDeMesa(modalDetalle.id)"
            type="button"
            class="flex-1 rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 transition-colors hover:bg-cafe-800"
            @click="abrirAgregarPlatos"
          >
            Agregar platos
          </button>
          <button
            v-if="esMesero && datos.pedidoDeMesa(modalDetalle.id)"
            type="button"
            class="rounded-lg border border-cafe-700/25 bg-white px-4 py-2 text-sm font-semibold text-cafe-700 transition-colors hover:bg-crema-200"
            @click="abrirCambioMesa"
          >
            Cambiar mesa
          </button>
          <button
            v-if="esMesero"
            type="button"
            :disabled="guardandoCancelacion"
            class="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            @click="cancelarMesaActual"
          >
            {{ guardandoCancelacion ? 'Cancelando...' : 'Cancelar mesa' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-cafe-700/25 bg-white px-4 py-2 text-sm font-semibold text-cafe-700 transition-colors hover:bg-crema-200"
            @click="modalDetalle = null"
          >
            Volver a las mesas
          </button>
        </div>
      </div>
    </div>
  </div>
</template>