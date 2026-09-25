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
  return request('/menu/products')
}

export function getMenuCategorias() {
  return request('/menu/categories')
}

export function crearProductoMenu(datos) {
  return request('/menu/products', {
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
  return request(`/menu/products/${id}`, {
    method: 'DELETE',
  })
}

export function getMesas() {
  return request('/mesas')
}

export function getPedidos() {
  return request('/pedidos')
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

export function registrarPago(pedidoId) {
  return request('/pagos', {
    method: 'POST',
    body: { pedidoId },
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