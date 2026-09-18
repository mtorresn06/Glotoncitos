<script setup>
import { computed } from 'vue'
import { useDatosStore } from '../stores/datos'
import { ETIQUETAS_ESTADO, formatearPrecio } from '../utils/formato'

const props = defineProps({
  pedido: { type: Object, required: true },
  mesa: { type: Object, required: true },
  mostrarEstado: { type: Boolean, default: true },
})

const datos = useDatosStore()

const total = computed(() => datos.totalPedido(props.pedido))

const clasesEstado = {
  pendiente: 'bg-crema-200 text-cafe-700',
  en_preparacion: 'bg-amber-200 text-amber-900',
  listo: 'bg-green-100 text-green-800',
}
</script>

<template>
  <div class="rounded-2xl border border-cafe-900/10 bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-crema-200 px-5 py-3">
      <div>
        <p class="font-bold text-cafe-800">{{ mesa.nombre }}</p>
        <p class="text-xs text-cafe-500">Piso {{ mesa.piso }}</p>
      </div>
      <p class="text-sm font-semibold text-cafe-500">{{ pedido.productos.length }} producto(s)</p>
    </div>

    <ul class="divide-y divide-crema-100 px-5">
      <li
        v-for="(producto, indice) in pedido.productos"
        :key="indice"
        class="flex items-start justify-between gap-3 py-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-cafe-800">
            <span class="text-cafe-400">{{ producto.cantidad }}×</span>
            {{ producto.nombre }}
          </p>
          <p v-if="producto.nota" class="text-sm italic text-cafe-500">Nota: {{ producto.nota }}</p>
        </div>
        <div class="flex flex-none flex-col items-end gap-1">
          <span class="text-sm text-cafe-500">{{ formatearPrecio(producto.precio * producto.cantidad) }}</span>
          <span
            v-if="mostrarEstado"
            class="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            :class="clasesEstado[producto.estado]"
          >
            {{ ETIQUETAS_ESTADO[producto.estado] }}
          </span>
        </div>
      </li>
    </ul>

    <div class="flex items-center justify-between rounded-b-2xl bg-crema-200/60 px-5 py-3">
      <span class="font-semibold text-cafe-600">Total</span>
      <span class="text-lg font-extrabold text-cafe-800">{{ formatearPrecio(total) }}</span>
    </div>
  </div>
</template>