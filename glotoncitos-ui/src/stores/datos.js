import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const hace = (min) => Date.now() - min * 60 * 1000

export const useDatosStore = defineStore('datos', () => {
  const menu = ref([
    { id: 'tequenos', nombre: 'Tequeños', precio: 18, categoria: 'Entradas' },
    { id: 'huancaina', nombre: 'Papa a la Huancaína', precio: 16, categoria: 'Entradas' },
    { id: 'ceviche', nombre: 'Ceviche Mixto', precio: 28, categoria: 'Entradas' },
    { id: 'chaufa', nombre: 'Arroz Chaufa', precio: 24, categoria: 'Platos Principales' },
    { id: 'lomo', nombre: 'Lomo Saltado', precio: 32, categoria: 'Platos Principales' },
    { id: 'aji', nombre: 'Ají de Gallina', precio: 26, categoria: 'Platos Principales' },
    { id: 'tallarin', nombre: 'Tallarín Saltado', precio: 25, categoria: 'Platos Principales' },
    { id: 'chicha', nombre: 'Chicha Morada', precio: 8, categoria: 'Bebidas' },
    { id: 'inca', nombre: 'Inca Kola 500 ml', precio: 7, categoria: 'Bebidas' },
    { id: 'alfajor', nombre: 'Alfajor de Maicena', precio: 6, categoria: 'Postres' },
  ])

  const mesas = ref([
    { id: 1, nombre: 'Mesa 1', piso: 1, estado: 'libre', ocupadaDesde: null },
    { id: 2, nombre: 'Mesa 2', piso: 1, estado: 'libre', ocupadaDesde: null },
    { id: 3, nombre: 'Mesa 3', piso: 1, estado: 'ocupada', ocupadaDesde: hace(28) },
    { id: 4, nombre: 'Mesa 4', piso: 1, estado: 'libre', ocupadaDesde: null },
    { id: 5, nombre: 'Mesa 5', piso: 1, estado: 'libre', ocupadaDesde: null },
    { id: 6, nombre: 'Mesa 6', piso: 1, estado: 'libre', ocupadaDesde: null },
    { id: 7, nombre: 'Mesa 7', piso: 2, estado: 'libre', ocupadaDesde: null },
    { id: 8, nombre: 'Mesa 8', piso: 2, estado: 'ocupada', ocupadaDesde: hace(15) },
    { id: 9, nombre: 'Mesa 9', piso: 2, estado: 'libre', ocupadaDesde: null },
    { id: 10, nombre: 'Mesa 10', piso: 2, estado: 'libre', ocupadaDesde: null },
    { id: 11, nombre: 'Mesa 11', piso: 2, estado: 'libre', ocupadaDesde: null },
    { id: 12, nombre: 'Mesa 12', piso: 3, estado: 'libre', ocupadaDesde: null },
    { id: 13, nombre: 'Mesa 13', piso: 3, estado: 'libre', ocupadaDesde: null },
    { id: 14, nombre: 'Mesa 14', piso: 3, estado: 'libre', ocupadaDesde: null },
    { id: 15, nombre: 'Mesa 15', piso: 3, estado: 'libre', ocupadaDesde: null },
  ])

  const pedidos = ref([
    {
      id: 'o-1',
      mesaId: 3,
      creadoEn: hace(28),
      productos: [
        { productoId: 'huancaina', nombre: 'Papa a la Huancaína', precio: 16, cantidad: 1, nota: 'sin picante', estado: 'pendiente' },
        { productoId: 'lomo', nombre: 'Lomo Saltado', precio: 32, cantidad: 2, nota: '', estado: 'en_preparacion' },
        { productoId: 'inca', nombre: 'Inca Kola 500 ml', precio: 7, cantidad: 2, nota: 'bien frías', estado: 'listo' },
      ],
    },
    {
      id: 'o-2',
      mesaId: 8,
      creadoEn: hace(15),
      productos: [
        { productoId: 'chaufa', nombre: 'Arroz Chaufa', precio: 24, cantidad: 3, nota: '', estado: 'pendiente' },
        { productoId: 'chicha', nombre: 'Chicha Morada', precio: 8, cantidad: 3, nota: '', estado: 'pendiente' },
      ],
    },
  ])

  const pedidosCerrados = ref([
    {
      mesaNombre: 'Mesa 12',
      total: 92,
      pagadoEn: hace(190),
      productos: [
        { nombre: 'Lomo Saltado', cantidad: 2 },
        { nombre: 'Inca Kola 500 ml', cantidad: 2 },
      ],
    },
    {
      mesaNombre: 'Mesa 5',
      total: 62,
      pagadoEn: hace(120),
      productos: [
        { nombre: 'Ají de Gallina', cantidad: 1 },
        { nombre: 'Chicha Morada', cantidad: 1 },
        { nombre: 'Alfajor de Maicena', cantidad: 2 },
      ],
    },
    {
      mesaNombre: 'Mesa 2',
      total: 74,
      pagadoEn: hace(45),
      productos: [
        { nombre: 'Arroz Chaufa', cantidad: 2 },
        { nombre: 'Ceviche Mixto', cantidad: 1 },
      ],
    },
  ])

  const ventasBase = ref(700)
  const trabajadores = ref([
    { nombre: 'María Quispe', rol: 'Mesera' },
    { nombre: 'Carlos Rojas', rol: 'Cocina' },
    { nombre: 'Lucía Fernández', rol: 'Cajera' },
    { nombre: 'Jorge Salazar', rol: 'Administrador' },
    { nombre: 'Ana Torres', rol: 'Mesera' },
    { nombre: 'Pedro Núñez', rol: 'Cocina' },
  ])

  let contadorPedidos = pedidos.value.length

  function mesaPorId(id) {
    return mesas.value.find((m) => m.id === id) || null
  }

  function pedidoDeMesa(mesaId) {
    return pedidos.value.find((p) => p.mesaId === mesaId) || null
  }

  function totalPedido(pedido) {
    return pedido.productos.reduce((suma, p) => suma + p.precio * p.cantidad, 0)
  }

  function totalDeMesa(mesaId) {
    const pedido = pedidoDeMesa(mesaId)
    return pedido ? totalPedido(pedido) : 0
  }

  function pedidoCompleto(pedido) {
    return pedido.productos.length > 0 && pedido.productos.every((p) => p.estado === 'listo')
  }

  function crearPedido(mesaId, items) {
    const productos = items.map((item) => {
      const producto = menu.value.find((p) => p.id === item.productoId)
      return {
        productoId: item.productoId,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: item.cantidad,
        nota: (item.nota || '').trim(),
        estado: 'pendiente',
      }
    })

    const ahora = Date.now()
    const mesa = mesaPorId(mesaId)
    mesa.estado = 'ocupada'
    mesa.ocupadaDesde = ahora

    const pedido = {
      id: `o-${++contadorPedidos}`,
      mesaId,
      creadoEn: ahora,
      productos,
    }
    pedidos.value.push(pedido)
    return pedido.id
  }

  function avanzarProducto(pedidoId, indice) {
    const pedido = pedidos.value.find((p) => p.id === pedidoId)
    if (!pedido) return
    const producto = pedido.productos[indice]
    const pasos = ['pendiente', 'en_preparacion', 'listo']
    const posicion = pasos.indexOf(producto.estado)
    if (posicion < pasos.length - 1) {
      producto.estado = pasos[posicion + 1]
    }
  }

  function registrarPago(pedidoId) {
    const indice = pedidos.value.findIndex((p) => p.id === pedidoId)
    if (indice === -1) return
    const pedido = pedidos.value[indice]
    const mesa = mesaPorId(pedido.mesaId)
    mesa.estado = 'libre'
    mesa.ocupadaDesde = null
    pedido.productos.forEach((p) => delete p.estado)
    pedidosCerrados.value.unshift({
      mesaNombre: mesa.nombre,
      total: totalPedido(pedido),
      pagadoEn: Date.now(),
      productos: pedido.productos.map((p) => ({ nombre: p.nombre, cantidad: p.cantidad })),
    })
    pedidos.value.splice(indice, 1)
  }

  const pisos = computed(() => [...new Set(mesas.value.map((m) => m.piso))].sort((a, b) => a - b))

  const mesasPorPiso = (piso) => mesas.value.filter((m) => m.piso === piso)

  const mesasOcupadas = computed(() => mesas.value.filter((m) => m.estado === 'ocupada'))

  const mesasLibres = computed(() => mesas.value.filter((m) => m.estado === 'libre'))

  const ventasDelDia = computed(
    () => ventasBase.value + pedidosCerrados.value.reduce((suma, p) => suma + p.total, 0),
  )

  const numeroPedidos = computed(() => pedidos.value.length + pedidosCerrados.value.length)

  const platosMasPedidos = computed(() => {
    const conteo = {}
    const sumar = (producto) => {
      conteo[producto.nombre] = (conteo[producto.nombre] || 0) + producto.cantidad
    }
    pedidos.value.forEach((p) => p.productos.forEach(sumar))
    pedidosCerrados.value.forEach((p) => p.productos.forEach(sumar))
    return Object.entries(conteo)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
  })

  return {
    menu,
    mesas,
    pedidos,
    pedidosCerrados,
    trabajadores,
    pisos,
    mesasPorPiso,
    mesasOcupadas,
    mesasLibres,
    ventasDelDia,
    numeroPedidos,
    platosMasPedidos,
    mesaPorId,
    pedidoDeMesa,
    totalDeMesa,
    totalPedido,
    pedidoCompleto,
    crearPedido,
    avanzarProducto,
    registrarPago,
  }
})