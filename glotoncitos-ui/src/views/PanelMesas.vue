<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import { useSesionStore } from '../stores/sesion'
import TarjetaMesa from '../components/TarjetaMesa.vue'
import ModalCrearPedido from '../components/ModalCrearPedido.vue'
import DetallePedido from '../components/DetallePedido.vue'

const datos = useDatosStore()
const sesion = useSesionStore()

const pisoActivo = ref(1)
const modalCrear = ref(null)
const modalDetalle = ref(null)
const modalPiso = ref(false)
const modalMesa = ref(false)
const nuevoPiso = ref('')
const nuevaMesa = reactive({ numero: '', capacidad: '', idPiso: '' })
const errorGestion = ref('')
const numeroMesa = ref('')
const guardandoMesa = ref(false)
const guardando = ref(false)
const ahora = ref(Date.now())
const esAdmin = computed(() => sesion.rolId === 'administrador')

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
  if (esAdmin.value) {
    modalDetalle.value = mesa
    numeroMesa.value = String(mesa.nombre)
    errorGestion.value = ''
    return
  }

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
          :modo-admin="esAdmin"
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
            <p v-if="errorGestion" class="mt-2 text-sm text-red-700">{{ errorGestion }}</p>
          </form>

          <template v-if="datos.pedidoDeMesa(modalDetalle.id)">
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