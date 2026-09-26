import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSesionStore } from './sesion'
import {
  getProductos,
  getMesas,
  getPedidos,
  getPedidosListos,
  getPedidosCerrados,
  getTrabajadores,
  getPisos,
  crearPiso as apiCrearPiso,
  crearMesa as apiCrearMesa,
  actualizarMesa as apiActualizarMesa,
  cambiarEstadoMesa as apiCambiarEstadoMesa,
  agregarProductosPedido as apiAgregarProductosPedido,
  cancelarMesa as apiCancelarMesa,
  cambiarMesa as apiCambiarMesa,
  crearPedido as apiCrearPedido,
  avanzarProducto as apiAvanzarProducto,
  cancelarProducto as apiCancelarProducto,
  actualizarProducto as apiActualizarProducto,
  registrarPago as apiRegistrarPago,
} from '../services/api.js'

export const useDatosStore = defineStore('datos', () => {
  const sesion = useSesionStore()
  const menu = ref([])
  const mesas = ref([])
  const pisos = ref([])
  const pedidos = ref([])
  const pedidosListos = ref([])
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
    const pedido = pedidoDeMesa(mesaId) || pedidosListos.value.find((p) => p.mesaId === mesaId)
    return pedido ? totalPedido(pedido) : 0
  }

  function pedidoCompleto(pedido) {
    return pedido.productos.length > 0 && pedido.productos.every((p) => p.estado === 'listo')
  }

  const esAdmin = computed(() => sesion.rolId === 'administrador')
  const esMesero = computed(() => sesion.rolId === 'mesero')

  async function cargarDatos() {
    cargando.value = true
    error.value = ''
    try {
      const [
        productos,
        mesasData,
        pisosData,
        pedidosData,
        pedidosListosData,
        pedidosCerradosData,
        trabajadoresData,
      ] = await Promise.all([
        getProductos(),
        getMesas(),
        getPisos(),
        getPedidos(),
        esMesero.value ? getPedidosListos() : Promise.resolve([]),
        esAdmin.value ? getPedidosCerrados() : Promise.resolve([]),
        esAdmin.value ? getTrabajadores() : Promise.resolve([]),
      ])
      menu.value = productos
      mesas.value = mesasData
      pisos.value = pisosData
      pedidos.value = pedidosData
      pedidosListos.value = pedidosListosData
      pedidosCerrados.value = pedidosCerradosData
      trabajadores.value = trabajadoresData
    } catch (e) {
      error.value = e.message || 'Error al cargar datos'
    } finally {
      cargando.value = false
    }
  }

  async function crearPiso(numero) {
    const response = await apiCrearPiso({ numero })
    await cargarDatos()
    return response.piso
  }

  async function crearMesa({ numero, capacidad, idPiso }) {
    const response = await apiCrearMesa({ numero, capacidad, idPiso })
    await cargarDatos()
    return response.mesa
  }

  async function actualizarMesa(idMesa, { numero }) {
    const response = await apiActualizarMesa(idMesa, { numero })
    await cargarDatos()
    return response.mesa
  }

  async function cargarMesas() {
    const [mesasData, pisosData, pedidosListosData] = await Promise.all([
      getMesas(),
      getPisos(),
      esMesero.value ? getPedidosListos() : Promise.resolve([]),
    ])
    mesas.value = mesasData
    pisos.value = pisosData
    if (esMesero.value) pedidosListos.value = pedidosListosData
  }

  async function cambiarEstadoMesa(idMesa, estado) {
    const response = await apiCambiarEstadoMesa(idMesa, estado)
    await cargarMesas()
    return response.mesa
  }

  async function cancelarMesa(idMesa) {
    const response = await apiCancelarMesa(idMesa)
    await cargarDatos()
    return response.mesa
  }

  async function cambiarMesa(idMesa, idMesaDestino) {
    const response = await apiCambiarMesa(idMesa, idMesaDestino)
    await cargarDatos()
    return response.mesa
  }

  async function agregarProductosPedido(pedidoId, items) {
    const productos = items.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      nota: (item.nota || '').trim(),
    }))
    const response = await apiAgregarProductosPedido(pedidoId, productos)
    await cargarDatos()
    return response.pedido
  }

  async function crearPedido(mesaId, items, personas = 1) {
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

    const payload = { mesaId, productos, personas }
    const response = await apiCrearPedido(payload)

    await cargarDatos()
    return response.pedido?.id
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
    pedidosListos,
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
    crearPiso,
    crearMesa,
    actualizarMesa,
    cargarMesas,
    cambiarEstadoMesa,
    cancelarMesa,
    cambiarMesa,
    agregarProductosPedido,
    crearPedido,
    avanzarProducto,
    cancelarProducto,
    actualizarProducto,
    registrarPago,
  }
})