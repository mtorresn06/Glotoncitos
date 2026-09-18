<script setup>
import { computed } from 'vue'
import { useDatosStore } from '../stores/datos'
import { formatearTiempo } from '../utils/formato'

const props = defineProps({
  mesa: { type: Object, required: true },
  ahora: { type: Number, required: true },
})

const emit = defineEmits(['seleccionar'])

const datos = useDatosStore()

const pedido = computed(() => datos.pedidoDeMesa(props.mesa.id))
const ocupada = computed(() => props.mesa.estado === 'ocupada')
const listaCompleta = computed(() => (pedido.value ? datos.pedidoCompleto(pedido.value) : false))
const tiempoOcupada = computed(() =>
  props.mesa.ocupadaDesde ? formatearTiempo(props.mesa.ocupadaDesde, props.ahora) : '',
)
</script>

<template>
  <button
    type="button"
    class="flex flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-suave"
    :class="
      ocupada
        ? 'border-durazno-300 bg-crema-50 hover:border-durazno-400'
        : 'border-green-300 bg-green-50 hover:border-green-400'
    "
    @click="emit('seleccionar', mesa)"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-lg font-bold text-cafe-800">{{ mesa.nombre }}</p>
        <p class="text-xs text-cafe-500">Piso {{ mesa.piso }}</p>
      </div>
      <span
        v-if="ocupada"
        class="text-xs font-bold uppercase tracking-wide"
        :class="listaCompleta ? 'text-green-700' : 'text-durazno-500'"
      >
        {{ listaCompleta ? 'Listo' : 'Ocupada' }}
      </span>
      <span v-else class="text-xs font-bold uppercase tracking-wide text-green-700">Libre</span>
    </div>

    <p
      v-if="ocupada"
      class="rounded-lg px-2 py-1 text-sm font-semibold"
      :class="listaCompleta ? 'bg-green-100 text-green-800' : 'bg-durazno-100 text-cafe-700'"
    >
      {{ listaCompleta ? 'Pedido completo, se puede servir' : `Ocupada hace ${tiempoOcupada}` }}
    </p>
    <p v-else class="rounded-lg px-2 py-1 text-sm text-cafe-500">Tocar para tomar pedido</p>

    <p v-if="ocupada && !listaCompleta" class="text-xs text-cafe-400">
      {{ pedido.productos.length }} producto(s)
    </p>
  </button>
</template>