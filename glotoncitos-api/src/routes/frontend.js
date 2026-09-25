import { Router } from 'express'
import {
  listProducts,
  createProduct,
  updateProduct,
  getProduct,
} from '../services/menu-service.js'
import {
  listTables,
  getTable,
  createTable,
  updateTable,
} from '../services/table-service.js'
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderItem,
  updateOrderItemStatus,
} from '../services/order-service.js'
import { createPayment, listPayments } from '../services/payment-service.js'
import {
  getSalesByDate,
  getSalesSummary,
  getTopProducts,
  getTableTurnover,
  getWorkerStats,
  getSalesByMonth,
} from '../services/report-service.js'
import { authenticateToken, requireRoles, requireMesero, requireCajero, requireAdmin, requireCocina } from '../middleware/auth.js'
import { HttpError } from '../utils/errors.js'
import { normalizeUuid } from '../utils/validation.js'
import { pool } from '../db/pool.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

function formatProductItem(row) {
  return {
    id: row.id_producto,
    nombre: row.nombre,
    precio: Number(row.precio),
    categoria: row.categoria_nombre,
    disponible: row.disponible,
  }
}

function formatFrontendTable(row) {
  return {
    id: row.id_mesa,
    nombre: String(row.numero),
    estado: row.estado,
    piso: null,
    ocupadaDesde: row.ocupada_desde,
    capacity: row.capacity,
    restaurantId: row.id_restaurante,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }
}

function formatFrontendOrder(row) {
  return {
    id: row.id_pedidos,
    mesaId: row.id_mesa,
    mesaNombre: row.mesa_numero ? String(row.mesa_numero) : '',
    estado: row.estado,
    creadoEn: row.fecha_hora,
    actualizadoEn: row.actualizado_en,
    productos: (row.items || []).map((item) => ({
      productoId: item.id_producto,
      cantidad: item.quantity,
      nombre: item.productName,
      precio: item.unitPrice,
      estado: item.status,
      nota: item.notes,
    })),
    total: row.total,
    pagadoEn: row.fecha_hora,
  }
}

function formatFrontendClosedOrder(row) {
  return {
    id: row.id_pedidos,
    mesaId: row.id_mesa,
    mesaNombre: row.mesa_numero ? String(row.mesa_numero) : '',
    estado: row.estado,
    creadoEn: row.fecha_hora,
    actualizadoEn: row.actualizado_en,
    productos: (row.items || []).map((item) => ({
      productoId: item.id_producto,
      cantidad: item.quantity,
      nombre: item.productName,
      precio: item.unitPrice,
      estado: item.status,
      nota: item.notes,
    })),
    total: row.total,
    pagadoEn: row.fecha_hora,
  }
}

async function getOrderByIndex(orderId, restaurantId, index) {
  const order = await getOrder(orderId, restaurantId)
  if (!order) throw new HttpError(404, 'NOT_FOUND', 'Pedido no encontrado')
  const items = order.items || []
  if (index < 0 || index >= items.length) throw new HttpError(404, 'NOT_FOUND', 'Ítem no encontrado')
  return { order, item: items[index], itemId: items[index].id }
}

router.get('/productos', authenticateToken, asyncRoute(async (req, res) => {
  const availableOnly = req.query.availableOnly === 'true'
  const products = await listProducts(req.auth.restaurantId, { availableOnly })
  res.json(products.map(formatProductItem))
}))

router.post('/productos', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const product = await createProduct({
    restaurantId: req.auth.restaurantId,
    categoryId: req.body?.categoryId,
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    type: req.body?.type,
    available: req.body?.available,
  })
  res.status(201).json(formatProductItem(product))
}))

router.put('/productos/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const product = await updateProduct(req.params.id, req.auth.restaurantId, {
    categoryId: req.body?.categoryId,
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    type: req.body?.type,
    available: req.body?.available,
  })
  res.json(formatProductItem(product))
}))

router.get('/mesas', authenticateToken, asyncRoute(async (req, res) => {
  const tables = await listTables(req.auth.restaurantId)
  res.json(tables.map(formatFrontendTable))
}))

router.get('/mesas/:id', authenticateToken, asyncRoute(async (req, res) => {
  const table = await getTable(req.params.id, req.auth.restaurantId)
  res.json({ mesa: formatFrontendTable(table) })
}))

router.post('/mesas', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const table = await createTable({
    restaurantId: req.auth.restaurantId,
    number: req.body?.number,
    capacity: req.body?.capacity,
  })
  res.status(201).json({ mesa: formatFrontendTable(table) })
}))

router.put('/mesas/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const table = await updateTable(req.params.id, req.auth.restaurantId, {
    number: req.body?.number,
    capacity: req.body?.capacity,
    status: req.body?.status,
  })
  res.json({ mesa: formatFrontendTable(table) })
}))

router.get('/pedidos', authenticateToken, requireRoles('mesero', 'cajero', 'admin'), asyncRoute(async (req, res) => {
  const orders = await listOrders(req.auth.restaurantId, req.auth.roleCode, req.auth.userId)
  res.json(orders.map(formatFrontendOrder))
}))

router.get('/pedidos-cerrados', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const orders = await listOrders(req.auth.restaurantId, 'admin', req.auth.userId)
  const closed = orders.filter((o) => o.status === 'cerrado' || o.status === 'cancelado')
  res.json(closed.map(formatFrontendClosedOrder))
}))

router.get('/pedidos/:id', authenticateToken, requireRoles('mesero', 'cajero', 'admin'), asyncRoute(async (req, res) => {
  const order = await getOrder(req.params.id, req.auth.restaurantId, req.auth.roleCode, req.auth.userId)
  res.json({ pedido: formatFrontendOrder(order) })
}))

router.post('/pedidos', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const body = req.body || {}
  const items = body.productos || body.items || []
  const normalizedItems = items.map((item) => ({
    productoId: item.productoId || item.productId || item.id,
    cantidad: item.cantidad || item.quantity || 1,
    notas: item.nota || item.notas || '',
  }))
  const order = await createOrder({
    restaurantId: req.auth.restaurantId,
    userId: req.auth.userId,
    mesaId: body.mesaId || body.tableId || body.id_mesa,
    items: normalizedItems,
  })
  res.status(201).json({ pedido: formatFrontendOrder(order) })
}))

router.patch('/pedidos/:id/items/:indice', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const { id, indice } = req.params
  const index = Number(indice)
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, 'BAD_REQUEST', 'Índice inválido')
  const { order, itemId } = await getOrderByIndex(id, req.auth.restaurantId, index)
  const body = req.body || {}
  const result = await updateOrderItem({
    orderId: id,
    itemId,
    restaurantId: req.auth.restaurantId,
    quantity: body.cantidad !== undefined ? body.cantidad : body.quantity,
    notes: body.nota !== undefined ? body.nota : body.notas,
    cancel: body.cancel === true || body.cancel === 'true',
  })
  res.json({ pedido: formatFrontendOrder(result) })
}))

router.patch('/pedidos/:id/items/:indice/avanzar', authenticateToken, requireCocina, asyncRoute(async (req, res) => {
  const { id, indice } = req.params
  const index = Number(indice)
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, 'BAD_REQUEST', 'Índice inválido')
  const { order, item, itemId } = await getOrderByIndex(id, req.auth.restaurantId, index)
  const currentStatus = item.status
  const nextStatus = currentStatus === 'pendiente' ? 'en_preparacion' : currentStatus === 'en_preparacion' ? 'listo' : null
  if (!nextStatus) throw new HttpError(400, 'BAD_REQUEST', 'No se puede avanzar este item')
  const result = await updateOrderItemStatus({
    orderId: id,
    itemId,
    restaurantId: req.auth.restaurantId,
    status: nextStatus,
  })
  res.json({ pedido: formatFrontendOrder(result) })
}))

router.delete('/pedidos/:id/items/:indice', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const { id, indice } = req.params
  const index = Number(indice)
  if (!Number.isInteger(index) || index < 0) throw new HttpError(400, 'BAD_REQUEST', 'Índice inválido')
  const { order, itemId } = await getOrderByIndex(id, req.auth.restaurantId, index)
  const result = await updateOrderItem({
    orderId: id,
    itemId,
    restaurantId: req.auth.restaurantId,
    cancel: true,
  })
  res.json({ pedido: formatFrontendOrder(result) })
}))

router.post('/pagos', authenticateToken, requireRoles('cajero', 'admin'), asyncRoute(async (req, res) => {
  const body = req.body || {}
  const orderId = body.pedidoId || body.orderId || body.id_pedido
  const method = body.method || body.metodo_pago || 'efectivo'
  const payment = await createPayment({
    orderId,
    method,
    userId: req.auth.userId,
    restaurantId: req.auth.restaurantId,
  })
  res.status(201).json({ pago: payment.payment, pedido: payment.order })
}))

router.get('/pagos', authenticateToken, requireRoles('cajero', 'admin'), asyncRoute(async (req, res) => {
  const query = req.query || {}
  const payments = await listPayments({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
    method: query.method || query.metodo_pago || null,
  })
  res.json({ pagos: payments })
}))

router.get('/reportes/ventas-resumen', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const summary = await getSalesSummary({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
  })
  res.json(summary)
}))

router.get('/reportes/ventas-fecha', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const data = await getSalesByDate({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
  })
  res.json({ ventasByDate: data })
}))

router.get('/reportes/ventas-mes', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const data = await getSalesByMonth({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
  })
  res.json({ ventasByMonth: data })
}))

router.get('/reportes/productos-top', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const limit = query.limit || query.limite || 10
  const data = await getTopProducts({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
    limit: Number(limit),
  })
  res.json({ topProducts: data })
}))

router.get('/reportes/giro-mesas', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const data = await getTableTurnover({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
  })
  res.json({ tableTurnover: data })
}))

router.get('/reportes/estadisticas-trabajadores', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const query = req.query || {}
  const data = await getWorkerStats({
    restaurantId: req.auth.restaurantId,
    dateFrom: query.dateFrom || query.fecha_desde || null,
    dateTo: query.dateTo || query.fecha_hasta || null,
  })
  res.json({ workerStats: data })
}))

// CORREGIDO: Listar trabajadores usando id_usuario
router.get('/trabajadores', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.id_restaurante AS restaurant_id,
            r.codigo AS role_code, r.nombre AS role_name
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_restaurante = $1
       AND u.id_usuario <> $2
     ORDER BY r.nombre, u.nombre`,
    [req.auth.restaurantId, req.auth.userId],
  )
  const trabajadores = result.rows.map((row) => ({
    id: row.id_usuario,
    name: row.nombre,
    email: row.correo,
    restaurantId: row.restaurant_id,
    roleCode: row.role_code,
    roleName: row.role_name,
    active: row.estado,
  }))
  res.json(trabajadores)
}))

// NUEVO: Eliminar producto del menú
router.delete('/productos/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(
    `DELETE FROM productos WHERE id_producto = $1 AND id_restaurante = $2 RETURNING id_producto`,
    [req.params.id, req.auth.restaurantId]
  )
  if (result.rowCount === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Producto no encontrado')
  }
  res.json({ message: 'Producto eliminado correctamente' })
}))

// NUEVO: Modificar trabajador existente
router.put('/trabajadores/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const { id } = req.params
  if (id === req.auth.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'No puedes modificar tu propia cuenta de administrador')
  }
  const body = req.body || {}
  const nombre = body.name || body.nombre
  const email = body.email || body.correo
  const roleCode = body.roleCode || body.rol
  const active = body.active !== undefined ? body.active : body.estado

  if (roleCode && !['mesero', 'cajero', 'cocina'].includes(String(roleCode).trim().toLowerCase())) {
    throw new HttpError(400, 'BAD_REQUEST', 'roleCode debe ser mesero, cajero o cocina')
  }

  let roleId = undefined
  if (roleCode) {
    const rolesResult = await pool.query('SELECT id_rol FROM roles WHERE codigo = $1', [roleCode])
    if (rolesResult.rowCount === 0) throw new HttpError(400, 'BAD_REQUEST', 'Rol no encontrado')
    roleId = rolesResult.rows[0].id_rol
  }

  const result = await pool.query(
    `UPDATE usuarios
     SET nombre = COALESCE($1, nombre),
         correo = COALESCE($2, correo),
         id_rol = COALESCE($3, id_rol),
         estado = COALESCE(CAST($4 AS BOOLEAN), estado),
         actualizado_en = now()
     WHERE id_usuario = $5 AND id_restaurante = $6
     RETURNING id_usuario, nombre, correo, estado`,
    [nombre, email, roleId, active, id, req.auth.restaurantId]
  )

  if (result.rowCount === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Trabajador no encontrado')
  }

  res.json({
    id: result.rows[0].id_usuario,
    name: result.rows[0].nombre,
    email: result.rows[0].correo,
    roleCode,
    active: result.rows[0].estado,
  })
}))

// NUEVO: Eliminar trabajador
router.delete('/trabajadores/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  if (req.params.id === req.auth.userId) {
    throw new HttpError(400, 'BAD_REQUEST', 'No puedes eliminar tu propia cuenta de administrador')
  }
  const result = await pool.query(
    `DELETE FROM usuarios WHERE id_usuario = $1 AND id_restaurante = $2 RETURNING id_usuario`,
    [req.params.id, req.auth.restaurantId]
  )
  if (result.rowCount === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Trabajador no encontrado')
  }
  res.json({ message: 'Trabajador eliminado correctamente' })
}))

router.post('/trabajadores', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {}
  const nombre = String(body.name || body.nombre || '').trim()
  const email = String(body.email || body.correo || '').trim().toLowerCase()
  const password = String(body.password || body.contraseña || '')
  const roleCode = String(body.roleCode || body.rol || '').trim().toLowerCase()
  const restaurantId = body.restaurantId || body.id_restaurante || req.auth.restaurantId

  if (!nombre || !email || !password || !roleCode || !restaurantId) {
    throw new HttpError(400, 'BAD_REQUEST', 'Faltan campos obligatorios: name, email, password, roleCode, restaurantId')
  }
  if (!email.endsWith('@glotoncitos.com')) {
    throw new HttpError(400, 'BAD_REQUEST', 'El correo debe terminar en @glotoncitos.com')
  }
  if (password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'BAD_REQUEST', 'La contraseña debe tener entre 12 y 128 caracteres')
  }
  if (!['mesero', 'cajero', 'cocina'].includes(roleCode)) {
    throw new HttpError(400, 'BAD_REQUEST', 'roleCode debe ser mesero, cajero o cocina')
  }

  let normalizedRestaurantId
  try {
    normalizedRestaurantId = normalizeUuid(restaurantId, 'Restaurant ID')
  } catch (error) {
    throw new HttpError(400, 'BAD_REQUEST', 'El ID del restaurante no es válido')
  }
  if (normalizedRestaurantId !== req.auth.restaurantId) {
    throw new HttpError(403, 'FORBIDDEN', 'No puedes crear usuarios en otro restaurante')
  }

  const bcrypt = (await import('bcryptjs')).default
  const hash = await bcrypt.hash(password, 12)

  const rolesResult = await pool.query('SELECT id_rol FROM roles WHERE codigo = $1', [roleCode])
  if (rolesResult.rowCount === 0) throw new HttpError(400, 'BAD_REQUEST', 'Rol no encontrado')
  const roleId = rolesResult.rows[0].id_rol

  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_restaurante, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nombre, correo, estado`,
      [nombre, email, hash, roleId, normalizedRestaurantId, req.auth.userId],
    )
    res.status(201).json({
      id: result.rows[0].id_usuario,
      name: result.rows[0].nombre,
      email: result.rows[0].correo,
      restaurantId: normalizedRestaurantId,
      roleCode,
      active: result.rows[0].estado,
    })
  } catch (error) {
    if (error?.code === '23505') {
      throw new HttpError(409, 'CONFLICT', 'El correo ya está registrado')
    }
    throw error
  }
}))

export default router
