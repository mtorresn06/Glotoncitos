<script setup>
import { computed } from 'vue'
import { useDatosStore } from '../stores/datos'
import { formatearTiempo } from '../utils/formato'

const props = defineProps({
  mesa: { type: Object, required: true },
  ahora: { type: Number, required: true },
  modoAdmin: { type: Boolean, default: false },
})

const emit = defineEmits(['seleccionar'])

const datos = useDatosStore()

const pedido = computed(() => datos.pedidoDeMesa(props.mesa.id))
const sinAtender = computed(() => props.mesa.estado === 'sin_atender')
const atendida = computed(() => props.mesa.estado === 'atendida')
const tiempoSinAtender = computed(() =>
  sinAtender.value && props.mesa.ocupadaDesde
    ? formatearTiempo(props.mesa.ocupadaDesde, props.ahora)
    : '-',
)
const personas = computed(() => props.mesa.ocupadaPersonas || '-')
const etiquetaEstado = computed(() => {
  if (sinAtender.value) return 'Sin atender'
  if (atendida.value) return 'Atendida'
  if (props.mesa.estado === 'reservada') return 'Reservada'
  return 'Disponible'
})
</script>

<template>
  <button
    type="button"
    class="flex flex-col gap-2 rounded-2xl border-2 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-suave"
    :class="
      sinAtender
        ? 'border-red-200 bg-red-50 hover:border-red-300'
        : 'border-green-200 bg-green-50 hover:border-green-300'
    "
    @click="emit('seleccionar', mesa)"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-lg font-bold text-cafe-800">{{ mesa.nombre }}</p>
        <p class="text-xs text-cafe-500">Piso {{ mesa.piso }}</p>
      </div>
      <span
        class="text-xs font-bold uppercase tracking-wide"
        :class="sinAtender ? 'text-red-700' : 'text-green-700'"
      >
        {{ etiquetaEstado }}
      </span>
    </div>

    <div class="flex items-center justify-between gap-2 text-sm">
      <span class="font-semibold text-cafe-600">Personas: {{ personas }}</span>
      <span
        class="font-semibold"
        :class="sinAtender ? 'text-red-700' : 'text-cafe-400'"
      >
        Sin atender: {{ tiempoSinAtender }}
      </span>
    </div>

    <p
      v-if="sinAtender && pedido"
      class="rounded-lg bg-red-100 px-2 py-1 text-sm font-semibold text-red-800"
    >
      {{ mesa.pedidoListo ? 'Comida lista, falta aceptarla' : 'Pedido en proceso' }}
    </p>
    <p
      v-else-if="atendida"
      class="rounded-lg bg-green-100 px-2 py-1 text-sm font-semibold text-green-800"
    >
      Mesa atendida
    </p>
    <p v-else class="rounded-lg px-2 py-1 text-sm text-cafe-500">
      {{ modoAdmin ? 'Tocar para editar el número' : 'Tocar para tomar pedido' }}
    </p>

    <p v-if="pedido" class="text-xs text-cafe-400">
      {{ pedido.productos.length }} producto(s)
    </p>
  </button>
</template>