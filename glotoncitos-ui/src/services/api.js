const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')

async function request(ruta, options = {}) {
  const sesionStore = (await import('../stores/sesion.js')).useSesionStore()
  const token = sesionStore.token

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_URL}${ruta}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.error?.message || 'No se pudo conectar con el servidor')
    error.status = response.status
    throw error
  }

  return data
}

export function login(credenciales) {
  return request('/auth/login', {
    method: 'POST',
    body: credenciales,
  })
}

export function getProductos() {
  return request('/productos')
}

export function getMenuProductos() {
  return request('/menu/productos')
}

export function getMenuCategorias() {
  return request('/menu/categorias')
}

export function crearProductoMenu(datos) {
  return request('/menu/productos', {
    method: 'POST',
    body: datos,
  })
}

export function actualizarProductoMenu(id, datos) {
  return request(`/menu/products/${id}`, {
    method: 'PUT',
    body: datos,
  })
}

export function eliminarProductoMenu(id) {
  return request(`/menu/productos/${id}`, {
    method: 'DELETE',
  })
}

export function getMesas() {
  return request('/mesas')
}

export function getPisos() {
  return request('/pisos')
}

export function crearPiso(datos) {
  return request('/pisos', {
    method: 'POST',
    body: datos,
  })
}

export function eliminarPiso(id) {
  return request(`/pisos/${id}`, {
    method: 'DELETE',
  })
}

export function eliminarMesa(id) {
  return request(`/mesas/${id}`, {
    method: 'DELETE',
  })
}

export function crearMesa(datos) {
  return request('/mesas', {
    method: 'POST',
    body: datos,
  })
}

export function actualizarMesa(id, datos) {
  return request(`/mesas/${id}`, {
    method: 'PUT',
    body: datos,
  })
}

export function cambiarEstadoMesa(id, estado) {
  return request(`/mesas/${id}/estado`, {
    method: 'PATCH',
    body: { estado },
  })
}

export function cancelarMesa(id) {
  return request(`/mesas/${id}/cancelar`, { method: 'POST' })
}

export function cambiarMesa(id, idMesaDestino) {
  return request(`/mesas/${id}/cambiar-mesa`, {
    method: 'POST',
    body: { idMesaDestino },
  })
}

export function getPedidosCocina() {
  return request('/cocina/pedidos')
}

export function marcarProductoListo(pedidoId, indice) {
  return request(`/cocina/pedidos/${pedidoId}/items/${indice}`, {
    method: 'PATCH',
  })
}

export function confirmarPedidoListo(pedidoId) {
  return request(`/cocina/pedidos/${pedidoId}/listo`, {
    method: 'POST',
  })
}

export function getPedidos() {
  return request('/pedidos')
}

export function getPedidosListos() {
  return request('/pedidos/listos')
}

export function getPedidosCerrados() {
  return request('/pedidos-cerrados')
}

export function crearPedido(payload) {
  return request('/pedidos', {
    method: 'POST',
    body: payload,
  })
}

export function agregarProductosPedido(pedidoId, productos) {
  return request(`/pedidos/${pedidoId}/items`, {
    method: 'POST',
    body: { productos },
  })
}

export function avanzarProducto(pedidoId, indice) {
  return request(`/pedidos/${pedidoId}/items/${indice}/avanzar`, {
    method: 'PATCH',
  })
}

export function cancelarProducto(pedidoId, indice) {
  return request(`/pedidos/${pedidoId}/items/${indice}`, {
    method: 'DELETE',
  })
}

export function actualizarProducto(pedidoId, indice, datos) {
  return request(`/pedidos/${pedidoId}/items/${indice}`, {
    method: 'PATCH',
    body: datos,
  })
}

export function registrarPago(pedidoId, metodo) {
  return request('/pagos', {
    method: 'POST',
    body: { pedidoId, method: metodo },
  })
}

export function getPagos({ desde, hasta } = {}) {
  const query = new URLSearchParams()
  if (desde) query.set('dateFrom', desde)
  if (hasta) query.set('dateTo', hasta)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request(`/pagos${suffix}`)
}

export function revertirPago(id) {
  return request(`/pagos/${id}/revertir`, {
    method: 'POST',
  })
}

export function getTrabajadores() {
  return request('/trabajadores')
}

export function crearTrabajador(datos) {
  return request('/trabajadores', {
    method: 'POST',
    body: datos,
  })
}

export function eliminarTrabajador(id) {
  return request(`/trabajadores/${id}`, {
    method: 'DELETE',
  })
}

export function actualizarTrabajador(id, datos) {
  return request(`/trabajadores/${id}`, {
    method: 'PUT',
    body: datos,
  })
}