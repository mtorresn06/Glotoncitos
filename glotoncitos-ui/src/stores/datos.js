import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getProductos,
  getMesas,
  getPedidos,
  getPedidosCerrados,
  getTrabajadores, // <--- 1. Importado correctamente desde api.js
  crearPedido as apiCrearPedido,
  avanzarProducto as apiAvanzarProducto,
  cancelarProducto as apiCancelarProducto,
  actualizarProducto as apiActualizarProducto,
  registrarPago as apiRegistrarPago,
} from '../services/api.js'

export const useDatosStore = defineStore('datos', () => {
  const menu = ref([])
  const mesas = ref([])
  const pedidos = ref([])
  const pedidosCerrados = ref([])
  const trabajadores = ref([])
  const ventasBase = ref(0)

  const cargando = ref(false)
  const error = ref('')

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

  async function cargarDatos() {
    cargando.value = true
    error.value = ''
    try {
      // <--- 2. Añadido getTrabajadores y recibido en la variable correspondiente
      const [productos, mesasData, pedidosData, pedidosCerradosData, trabajadoresData] = await Promise.all([
        getProductos(),
        getMesas(),
        getPedidos(),
        getPedidosCerrados(),
        getTrabajadores(),
      ])
      menu.value = productos
      mesas.value = mesasData
      pedidos.value = pedidosData
      pedidosCerrados.value = pedidosCerradosData
      trabajadores.value = trabajadoresData // <--- 3. Asignado al ref de trabajadores
    } catch (e) {
      error.value = e.message || 'Error al cargar datos'
    } finally {
      cargando.value = false
    }
  }

  async function crearPedido(mesaId, items) {
    const productosMap = new Map(menu.value.map((p) => [p.id, p]))
    const productos = items.map((item) => {
      const producto = productosMap.get(item.productoId)
      return {
        productoId: item.productoId,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: item.cantidad,
        nota: (item.nota || '').trim(),
        estado: 'pendiente',
      }
    })

    const payload = { mesaId, productos }
    const response = await apiCrearPedido(payload)

    await cargarDatos()
    return response.id
  }

  async function avanzarProducto(pedidoId, indice) {
    await apiAvanzarProducto(pedidoId, indice)
    await cargarDatos()
  }

  async function cancelarProducto(pedidoId, indice) {
    await apiCancelarProducto(pedidoId, indice)
    await cargarDatos()
  }

  async function actualizarProducto(pedidoId, indice, datos) {
    await apiActualizarProducto(pedidoId, indice, datos)
    await cargarDatos()
  }

  async function registrarPago(pedidoId) {
    await apiRegistrarPago(pedidoId)
    await cargarDatos()
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
    cargando,
    error,
    mesaPorId,
    pedidoDeMesa,
    totalDeMesa,
    totalPedido,
    pedidoCompleto,
    cargarDatos,
    crearPedido,
    avanzarProducto,
    cancelarProducto,
    actualizarProducto,
    registrarPago,
  }
})