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
  getPagos,
  revertirPago as apiRevertirPago,
} from '../services/api.js'

function hoyEnLocal() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

function rangoDelDia(fecha) {
  const dia = fecha || hoyEnLocal()
  return {
    desde: new Date(`${dia}T00:00:00`).toISOString(),
    hasta: new Date(`${dia}T23:59:59.999`).toISOString(),
  }
}

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
  const reloj = ref(Date.now())
  const pagos = ref([])
  const fechaPagos = ref(hoyEnLocal())

  const CLAVE_RELOJ = '__glotoncitosReloj'

  function iniciarReloj() {
    detenerReloj()
    globalThis[CLAVE_RELOJ] = setInterval(() => {
      reloj.value = Date.now()
    }, 1000)
  }

  function detenerReloj() {
    if (globalThis[CLAVE_RELOJ]) {
      clearInterval(globalThis[CLAVE_RELOJ])
      globalThis[CLAVE_RELOJ] = null
    }
  }

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

  async function cargarCaja(fecha) {
    cargando.value = true
    try {
      const [mesasData, pisosData, pedidosData, pagosData] = await Promise.all([
        getMesas(),
        getPisos(),
        getPedidos(),
        getPagos(rangoDelDia(fecha)),
      ])
      mesas.value = mesasData
      pisos.value = pisosData
      pedidos.value = pedidosData
      pagos.value = Array.isArray(pagosData) ? pagosData : pagosData?.pagos || []
      error.value = ''
    } catch (e) {
      error.value = e.message || 'Error al cargar los datos de caja'
    } finally {
      cargando.value = false
    }
  }

  async function registrarPago(pedidoId, metodo) {
    const response = await apiRegistrarPago(pedidoId, metodo)
    await cargarCaja(fechaPagos.value)
    return response.pago
  }

  async function revertirPago(pagoId) {
    const response = await apiRevertirPago(pagoId)
    await cargarCaja(fechaPagos.value)
    return response.pago
  }

  const mesasPorPiso = (piso) => mesas.value.filter((m) => m.piso === piso)

  const mesasOcupadas = computed(() => mesas.value.filter((m) => m.estado === 'ocupada'))
  const mesasConCuenta = computed(() =>
    mesas.value.filter((mesa) => pedidoDeMesa(mesa.id)),
  )

  const pagosDelDia = computed(() => pagos.value.filter((pago) => pago.estado === 'pagado'))

  const totalesPorMetodo = computed(() => {
    const totales = {}
    pagosDelDia.value.forEach((pago) => {
      totales[pago.metodo] = (totales[pago.metodo] || 0) + Number(pago.total)
    })
    return totales
  })

  const totalCobradoDia = computed(() =>
    pagosDelDia.value.reduce((suma, pago) => suma + Number(pago.total), 0),
  )

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
    mesasConCuenta,
    mesasOcupadas,
    mesasLibres,
    pagos,
    fechaPagos,
    pagosDelDia,
    totalesPorMetodo,
    totalCobradoDia,
    ventasDelDia,
    numeroPedidos,
    platosMasPedidos,
    cargando,
    error,
    reloj,
    iniciarReloj,
    detenerReloj,
    mesaPorId,
    pedidoDeMesa,
    totalDeMesa,
    totalPedido,
    pedidoCompleto,
    cargarDatos,
    cargarCaja,
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
    revertirPago,
  }
})