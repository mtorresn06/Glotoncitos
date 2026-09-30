import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import * as api from '../../src/services/api.js'
import { useSesionStore } from '../../src/stores/sesion'

export const RESTAURANTE = '19c0ecf8-4ac1-4751-a3f1-f87d86389492'
export const ADMIN_ID = 'f9d361c6-4687-4ba9-a5f1-1a15a85a445e'

export const PISOS = [
  { id: 'piso-1', nombre: '1', numero: 1 },
  { id: 'piso-2', nombre: '2', numero: 2 },
  { id: 'piso-3', nombre: '3', numero: 3 },
]

export const MESAS = [
  { id: 'mesa-1', nombre: '1', estado: 'libre', piso: 1, idPiso: 'piso-1', pedidoListo: false, ocupadaDesde: null, ocupadaPersonas: null },
  { id: 'mesa-2', nombre: '2', estado: 'sin_atender', piso: 1, idPiso: 'piso-1', pedidoListo: true, ocupadaDesde: '2026-09-27T10:00:00.000Z', ocupadaPersonas: 4 },
  { id: 'mesa-9', nombre: '9', estado: 'libre', piso: 2, idPiso: 'piso-2', pedidoListo: false, ocupadaDesde: null, ocupadaPersonas: null },
]

// el piso 3 se deja vacio a proposito para probar el borrado de pisos

export const PEDIDOS = [
  {
    id: 'pedido-1',
    mesaId: 'mesa-2',
    mesaNombre: '2',
    estado: 'listo',
    creadoEn: '2026-09-27T10:00:00.000Z',
    total: 60,
    productos: [
      { id: 'item-1', nombreProducto: 'Ceviche', precio: 30, cantidad: 2, estado: 'listo' },
    ],
  },
]

export const CATEGORIAS = [
  { id: 'cat-1', nombre: 'Entradas' },
  { id: 'cat-2', nombre: 'Platos de fondo' },
]

export const PRODUCTOS_MENU = [
  { id: 'prod-1', nombre: 'Ceviche', descripcion: 'Fresco de la casa', precio: 30, tipo: 'plato', categoriaId: 'cat-1', disponible: true },
  { id: 'prod-2', nombre: 'Lomo saltado', descripcion: 'Clásico peruano', precio: 35, tipo: 'plato', categoriaId: 'cat-2', disponible: true },
]

export const TRABAJADORES = [
  { id: ADMIN_ID, nombre: 'Ana Admin', correo: 'ana@glotoncitos.com', rol: 'Administrador' },
  { id: 'trab-2', nombre: 'Luis Mesero', correo: 'luis@glotoncitos.com', rol: 'Mesero' },
]

export const PEDIDOS_CERRADOS = [
  {
    id: 'pedido-cerrado-1',
    mesaId: 'mesa-1',
    mesaNombre: '1',
    estado: 'cerrado',
    total: 150,
    creadoEn: '2026-09-27T09:00:00.000Z',
    productos: [
      { id: 'item-c1', nombre: 'Ceviche', nombreProducto: 'Ceviche', precio: 30, cantidad: 2, estado: 'listo' },
      { id: 'item-c2', nombre: 'Chicha morada', nombreProducto: 'Chicha morada', precio: 45, cantidad: 2, estado: 'listo' },
    ],
  },
]

export const VENTAS_DEL_DIA = 150

export function crearSesionAdmin() {
  setActivePinia(createPinia())
  const sesion = useSesionStore()
  sesion.token = 'token-de-prueba'
  sesion.rolId = 'administrador'
  sesion.usuario = {
    id: ADMIN_ID,
    email: 'ana@glotoncitos.com',
    restaurant: { id: RESTAURANTE, name: 'Glotoncitos' },
    roles: [{ code: 'admin' }],
  }
  return sesion
}

function resolver(valor) {
  return vi.fn().mockImplementation(() =>
    Promise.resolve(typeof valor === 'function' ? valor() : valor))
}

function rechazar(mensaje) {
  return vi.fn().mockRejectedValue(new Error(mensaje))
}

// Estado por defecto: como responde la api cuando todo va bien.
// Los valores pueden ser datos fijos o funciones para responder distinto en cada llamada.
export function configurarApiExitosa(sobrescritas = {}) {
  const valores = {
    getProductos: [],
    getMesas: MESAS,
    getPisos: PISOS,
    getPedidos: PEDIDOS,
    getPedidosListos: [],
    getPedidosCerrados: PEDIDOS_CERRADOS,
    getTrabajadores: TRABAJADORES,
    getPagos: [],
    getMenuCategorias: CATEGORIAS,
    getMenuProductos: PRODUCTOS_MENU,
    crearCategoriaMenu: undefined,
    actualizarCategoriaMenu: undefined,
    eliminarCategoriaMenu: undefined,
    ...sobrescritas,
  }

  for (const [nombre, valor] of Object.entries(valores)) {
    if (!api[nombre]) continue
    api[nombre].mockReset()
    api[nombre].mockImplementation(resolver(valor))
  }

  return api
}

export function rechazarLlamada(nombre, mensaje) {
  api[nombre].mockReset()
  api[nombre].mockImplementation(rechazar(mensaje))
  return api[nombre]
}

export function ningunaLlamada(nombre) {
  api[nombre].mockReset()
  api[nombre].mockImplementation(resolver(undefined))
  return api[nombre]
}

// Simula la latencia de la base de datos para medir tiempos de respuesta
export function conLatencia(nombre, ms, valor) {
  api[nombre].mockReset()
  api[nombre].mockImplementation(
    () => new Promise((resolve) => {
      setTimeout(() => resolve(typeof valor === 'function' ? valor() : valor), ms)
    }),
  )
  return api[nombre]
}
