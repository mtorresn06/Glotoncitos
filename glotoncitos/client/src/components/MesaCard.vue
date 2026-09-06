<script setup>
defineProps({ mesa: { type: Object, required: true } });
const emit = defineEmits(['toggle']);
</script>

<template>
  <button
    class="rounded-xl2 border-2 p-4 flex flex-col items-center gap-2 transition hover:scale-105"
    :class="mesa.estado === 'LIBRE' ? 'border-libre bg-libre/10' : 'border-ocupada bg-ocupada/10'"
    @click="emit('toggle', mesa)"
  >
    <span class="text-3xl">{{ mesa.estado === 'LIBRE' ? '🍽️' : '🍴' }}</span>
    <span class="font-semibold text-cafe-oscuro">Mesa {{ mesa.numero }}</span>
    <span
      class="text-xs px-2 py-0.5 rounded-full text-white"
      :class="mesa.estado === 'LIBRE' ? 'bg-libre' : 'bg-ocupada'"
    >
      {{ mesa.estado === 'LIBRE' ? 'Libre' : 'Ocupada' }}
    </span>
  </button>
</template>
