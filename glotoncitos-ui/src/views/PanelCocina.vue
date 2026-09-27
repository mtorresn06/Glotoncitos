<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useDatosStore } from '../stores/datos'

const datos = useDatosStore()

const ahora = computed(() => datos.reloj)
const errorCocina = ref('')
const guardando = ref(false)
let temporizador

function minutosTranscurridos(fecha) {
  if (!fecha) return 0
  const minutos = Math.floor((ahora.value - new Date(fecha).getTime()) / 60000)
  return minutos > 0 ? minutos : 0
}

function platosPendientes(pedido) {
  return pedido.productos
    .filter((producto) => producto.estado !== 'cancelado')
    .reduce((suma, producto) => suma + producto.cantidad, 0)
}

function puntajePrioridad(pedido) {
  return minutosTranscurridos(pedido.creadoEn) + 2 * platosPendientes(pedido)
}

const pedidosPriorizados = computed(() =>
  [...datos.pedidosCocina].sort((a, b) => {
    const diferencia = puntajePrioridad(b) - puntajePrioridad(a)
    if (diferencia !== 0) return diferencia
    return new Date(a.creadoEn) - new Date(b.creadoEn)
  }),
)

function productosActivos(pedido) {
  return pedido.productos.filter((producto) => producto.estado !== 'cancelado')
}

function checklistCompleto(pedido) {
  const productos = productosActivos(pedido)
  return productos.length > 0 && productos.every((producto) => producto.estado === 'listo')
}

function progreso(pedido) {
  const productos = productosActivos(pedido)
  const listos = productos.filter((producto) => producto.estado === 'listo').length
  return `${listos}/${productos.length}`
}

function esperandoMesero(pedido) {
  return pedido.estado === 'listo'
}

async function marcarListo(pedido, indice) {
  if (guardando.value) return
  guardando.value = true
  errorCocina.value = ''
  try {
    await datos.marcarProductoListo(pedido.id, indice)
  } catch (error) {
    errorCocina.value = error.message || 'No se pudo marcar el producto como listo'
  } finally {
    guardando.value = false
  }
}

async function confirmarOrdenLista(pedido) {
  if (guardando.value) return
  guardando.value = true
  errorCocina.value = ''
  try {
    await datos.confirmarPedidoListo(pedido.id)
  } catch (error) {
    errorCocina.value = error.message || 'No se pudo avisar la orden como lista'
  } finally {
    guardando.value = false
  }
}

onMounted(async () => {
  await datos.cargarCocina()
  datos.iniciarReloj()
  temporizador = setInterval(async () => {
    try {
      await datos.cargarCocina()
    } catch {
      return
    }
  }, 5000)
})

onBeforeUnmount(() => {
  clearInterval(temporizador)
  datos.detenerReloj()
})
</script>

<template>
  <div class="pt-8">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Panel de Cocina</h1>
        <p class="text-sm text-cafe-500">
          {{ pedidosPriorizados.length }} pedido(s) en cocina · toca cada plato cuando esté listo
        </p>
      </div>
      <p class="text-xs font-semibold text-cafe-400">
        Ordenado por urgencia: primero el que más tiempo lleva esperando y más platos tiene
      </p>
    </div>

    <p v-if="errorCocina" class="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ errorCocina }}
    </p>

    <div v-if="datos.cargando && datos.pedidosCocina.length === 0" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cafe-700"></div>
    </div>

    <div v-else-if="datos.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="text-sm">{{ datos.error }}</p>
      <button class="mt-2 rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50" @click="datos.cargarCocina">Reintentar</button>
    </div>

    <template v-else>
      <div
        v-if="pedidosPriorizados.length === 0"
        class="rounded-2xl border-2 border-dashed border-cafe-300/60 bg-white/60 p-12 text-center"
      >
        <p class="text-lg font-bold text-cafe-600">No hay pedidos en cocina</p>
        <p class="mt-1 text-sm text-cafe-400">
          Cuando el mesero envíe un pedido, aparecerá aquí automáticamente.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="(pedido, posicion) in pedidosPriorizados"
          :key="pedido.id"
          class="flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-suave"
          :class="esperandoMesero(pedido) ? 'border-green-300' : 'border-cafe-900/10'"
        >
          <header
            class="flex items-center justify-between gap-3 px-5 py-3"
            :class="esperandoMesero(pedido) ? 'bg-green-100' : 'bg-cafe-700'"
          >
            <div class="flex items-center gap-3">
              <span
                class="rounded-lg px-2 py-1 text-xs font-extrabold"
                :class="esperandoMesero(pedido) ? 'bg-green-700 text-white' : 'bg-crema-50/90 text-cafe-700'"
              >
                #{{ posicion + 1 }}
              </span>
              <div>
                <p class="font-bold text-white">Mesa {{ pedido.mesaNombre }}</p>
                <p :class="esperandoMesero(pedido) ? 'text-green-700' : 'text-crema-100/80'" class="text-xs">
                  {{ platosPendientes(pedido) }} plato(s) · {{ progreso(pedido) }} listos
                </p>
              </div>
            </div>
            <div class="text-right">
              <p
                class="text-sm font-extrabold"
                :class="esperandoMesero(pedido) ? 'text-green-800' : 'text-white'"
              >
                {{ esperandoMesero(pedido) ? 'Esperando mesero' : `Hace ${minutosTranscurridos(pedido.creadoEn)} min` }}
              </p>
              <p
                v-if="esperandoMesero(pedido)"
                class="text-xs font-semibold text-green-700"
              >
                Avisado hace {{ minutosTranscurridos(pedido.actualizadoEn) }} min
              </p>
            </div>
          </header>

          <ul class="flex-1 divide-y divide-crema-100 px-5">
            <li v-for="(producto, indice) in productosActivos(pedido)" :key="indice">
              <button
                type="button"
                :disabled="producto.estado === 'listo' || esperandoMesero(pedido) || guardando"
                class="flex w-full items-start gap-3 py-4 text-left transition-colors disabled:cursor-default"
                :class="producto.estado === 'listo' ? 'opacity-70' : 'hover:bg-crema-100'"
                @click="marcarListo(pedido, indice)"
              >
                <span
                  class="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg border-2 text-sm font-bold"
                  :class="
                    producto.estado === 'listo'
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-cafe-300 bg-white text-transparent'
                  "
                >
                  ✓
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block text-base font-semibold"
                    :class="producto.estado === 'listo' ? 'text-cafe-400 line-through' : 'text-cafe-800'"
                  >
                    <span class="text-cafe-400">{{ producto.cantidad }}×</span>
                    {{ producto.nombre }}
                  </span>
                  <span v-if="producto.nota" class="mt-1 block rounded-lg bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-800">
                    Nota: {{ producto.nota }}
                  </span>
                </span>
                <span
                  v-if="producto.estado === 'listo'"
                  class="flex-none rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-800"
                >
                  Listo
                </span>
                <span
                  v-else
                  class="flex-none rounded-full bg-crema-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cafe-600"
                >
                  Pendiente
                </span>
              </button>
            </li>
          </ul>

          <footer class="px-5 py-4">
            <div
              v-if="esperandoMesero(pedido)"
              class="rounded-xl bg-green-100 px-4 py-3 text-center text-sm font-bold text-green-800"
            >
              Orden avisada al mesero, no se puede modificar
            </div>
            <button
              v-else-if="checklistCompleto(pedido)"
              type="button"
              :disabled="guardando"
              class="w-full rounded-xl bg-green-700 px-4 py-3 text-base font-extrabold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
              @click="confirmarOrdenLista(pedido)"
            >
              {{ guardando ? 'Avisando...' : 'Orden lista' }}
            </button>
            <p
              v-else
              class="rounded-xl bg-crema-100 px-4 py-3 text-center text-sm font-semibold text-cafe-500"
            >
              Marca todos los platos para habilitar el aviso
            </p>
          </footer>
        </article>
      </div>
    </template>
  </div>
</template>
