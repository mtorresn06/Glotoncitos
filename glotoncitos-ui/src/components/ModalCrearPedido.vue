<script setup>
import { computed, reactive, ref } from 'vue'
import { useDatosStore } from '../stores/datos'
import { formatearPrecio } from '../utils/formato'

const props = defineProps({
  mesa: { type: Object, required: true },
  agregando: { type: Boolean, default: false },
})

const emit = defineEmits(['confirmar', 'cerrar'])

const datos = useDatosStore()

const seleccion = reactive({})
const personas = ref(1)
const busqueda = ref('')

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const productosFiltrados = computed(() => {
  const termino = normalizar(busqueda.value.trim())
  if (!termino) return datos.menu
  return datos.menu.filter((producto) => normalizar(producto.nombre).includes(termino))
})

const categorias = computed(() => {
  const lista = []
  productosFiltrados.value.forEach((producto) => {
    if (!lista.includes(producto.categoria)) lista.push(producto.categoria)
  })
  return lista
})

const total = computed(() => {
  let suma = 0
  datos.menu.forEach((producto) => {
    const item = seleccion[producto.id]
    if (item && item.cantidad > 0) suma += producto.precio * item.cantidad
  })
  return suma
})

const tieneItems = computed(
  () => datos.menu.some((producto) => (seleccion[producto.id]?.cantidad || 0) > 0),
)

const itemsSeleccionados = computed(() =>
  Object.entries(seleccion)
    .filter(([, item]) => item.cantidad > 0)
    .map(([productoId, item]) => ({ productoId, cantidad: item.cantidad, nota: item.nota })),
)

function cantidadDe(productoId) {
  return seleccion[productoId]?.cantidad || 0
}

function incrementar(productoId) {
  if (!seleccion[productoId]) seleccion[productoId] = { cantidad: 0, nota: '' }
  seleccion[productoId].cantidad += 1
}

function decrementar(productoId) {
  if (seleccion[productoId] && seleccion[productoId].cantidad > 0) {
    seleccion[productoId].cantidad -= 1
    if (seleccion[productoId].cantidad === 0) seleccion[productoId].nota = ''
  }
}

function confirmar() {
  if (!tieneItems.value) return
  emit('confirmar', { items: itemsSeleccionados.value, personas: Number(personas.value) })
}
</script>

<template>
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-cafe-900/50 p-4"
    @click.self="emit('cerrar')"
  >
    <div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-crema-50 shadow-2xl">
      <div class="flex items-center justify-between border-b border-crema-200 px-6 py-4">
        <div>
            <h2 class="text-xl font-extrabold text-cafe-800">
              {{ agregando ? 'Agregar platos' : 'Nuevo pedido' }}
            </h2>
            <p class="text-sm text-cafe-500">
              {{ mesa.nombre }} · Piso {{ mesa.piso }} · elige los productos del menú
            </p>
        </div>
        <button
          type="button"
          class="rounded-lg px-3 py-1 text-sm font-semibold text-cafe-500 transition-colors hover:bg-crema-200 hover:text-cafe-800"
          @click="emit('cerrar')"
        >
          Cerrar
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <div v-if="!agregando" class="mb-5">
          <label class="mb-2 block text-sm font-semibold text-cafe-700" for="personas-mesa">Número de personas</label>
          <input id="personas-mesa" v-model.number="personas" type="number" min="1" required class="w-32 rounded-lg border border-cafe-300 bg-white px-3 py-2 text-sm text-cafe-800" />
        </div>
        <div class="mb-5">
          <label class="mb-2 block text-sm font-semibold text-cafe-700" for="busqueda-producto">Buscar producto</label>
          <input
            id="busqueda-producto"
            v-model="busqueda"
            type="search"
            placeholder="Escribe el nombre del producto..."
            class="w-full rounded-lg border border-cafe-300 bg-white px-3 py-2 text-sm text-cafe-800 placeholder-cafe-400"
          />
        </div>
        <p v-if="categorias.length === 0" class="rounded-xl border border-dashed border-cafe-300 p-6 text-center text-sm text-cafe-500">
          No se encontraron productos.
        </p>
        <section v-for="categoria in categorias" :key="categoria" class="mb-6">
          <h3 class="mb-3 text-xs font-bold uppercase tracking-widest text-cafe-400">
            {{ categoria }}
          </h3>
          <ul class="space-y-2">
            <li
              v-for="producto in productosFiltrados.filter((p) => p.categoria === categoria)"
              :key="producto.id"
              class="rounded-xl border border-cafe-900/10 bg-white p-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-cafe-800">{{ producto.nombre }}</p>
                  <p class="text-sm text-cafe-500">{{ formatearPrecio(producto.precio) }}</p>
                </div>
                <div v-if="cantidadDe(producto.id) === 0" class="flex-none">
                  <button
                    type="button"
                    class="rounded-lg bg-cafe-700 px-4 py-1.5 text-sm font-bold text-crema-50 transition-colors hover:bg-cafe-800"
                    @click="incrementar(producto.id)"
                  >
                    Agregar
                  </button>
                </div>
                <div v-else class="flex flex-none items-center gap-3">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-crema-200 text-lg font-bold text-cafe-700 transition-colors hover:bg-crema-300"
                    @click="decrementar(producto.id)"
                  >
                    −
                  </button>
                  <span class="w-6 text-center font-bold text-cafe-800">
                    {{ seleccion[producto.id].cantidad }}
                  </span>
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg bg-cafe-700 text-lg font-bold text-crema-50 transition-colors hover:bg-cafe-800"
                    @click="incrementar(producto.id)"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                v-if="cantidadDe(producto.id) > 0"
                v-model="seleccion[producto.id].nota"
                type="text"
                placeholder="Nota para cocina (opcional)"
                class="mt-2 w-full rounded-lg border border-crema-300 bg-crema-50 px-3 py-1.5 text-sm text-cafe-800 placeholder-cafe-400 outline-none focus:border-durazno-400"
              />
            </li>
          </ul>
        </section>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-crema-200 bg-crema-100 px-6 py-4">
        <p class="text-sm font-semibold text-cafe-600">
          Total:
          <span class="text-xl font-extrabold text-cafe-800">{{ formatearPrecio(total) }}</span>
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-cafe-700/25 bg-white px-4 py-2 text-sm font-semibold text-cafe-700 transition-colors hover:bg-crema-200"
            @click="emit('cerrar')"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="!tieneItems"
            class="rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50 transition-colors enabled:hover:bg-cafe-800 disabled:cursor-not-allowed disabled:opacity-40"
            @click="confirmar"
          >
            {{ agregando ? 'Agregar a la orden' : 'Enviar a cocina' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>