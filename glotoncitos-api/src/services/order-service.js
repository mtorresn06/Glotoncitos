import { pool } from '../db/pool.js'
import { badRequest, forbidden, notFound } from '../utils/errors.js'
import {
  normalizeNotes,
  normalizePositiveInteger,
  normalizeQuantity,
  normalizeUuid,
} from '../utils/validation.js'

export function formatOrder(row) {
  return {
    id: row.id_pedido,
    restaurantId: row.id_restaurante,
    table: row.mesa_numero ? {
      id: row.id_mesa,
      number: row.mesa_numero,
      status: row.mesa_estado,
    } : null,
    user: row.usuario_nombre ? {
      id: row.id_usuario,
      name: row.usuario_nombre,
    } : null,
    status: row.estado,
    createdAt: row.fecha_hora,
    updatedAt: row.actualizado_en,
    total: row.total === undefined ? null : Number(row.total),
  }
}

export function formatOrderDetail(row) {
  return {
    id: row.id_detalle,
    productId: row.id_producto,
    productName: row.producto_nombre,
    quantity: row.cantidad,
    notes: row.notas,
    status: row.estado,
    unitPrice: Number(row.precio_unitario),
    subtotal: Number(row.precio_unitario) * row.cantidad,
  }
}

async function getOrderBase(orderId, restaurantId) {
  const result = await pool.query(
    `SELECT p.id_pedido, p.id_restaurante, p.id_mesa, p.id_usuario, p.fecha_hora,
            p.estado, p.actualizado_en, m.numero AS mesa_numero, m.estado AS mesa_estado,
            u.nombre AS usuario_nombre,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario)
              FILTER (WHERE dp.estado <> 'cancelado'), 0) AS total
     FROM pedidos p
     JOIN mesas m ON m.id_mesa = p.id_mesa AND m.id_restaurante = p.id_restaurante
     JOIN usuarios u ON u.id_usuario = p.id_usuario AND u.id_restaurante = p.id_restaurante
      LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
      WHERE p.id_pedido = $1 AND p.id_restaurante = $2
     GROUP BY p.id_pedido, m.numero, m.estado, u.nombre`,
    [orderId, restaurantId],
  )
  return result.rows[0] || null
}

async function getDetails(orderId, restaurantId) {
  const result = await pool.query(
    `SELECT dp.id_detalle, dp.id_producto, pr.nombre AS producto_nombre,
            dp.cantidad, dp.notas, dp.estado, dp.precio_unitario
     FROM detalles_pedido dp
     JOIN productos pr ON pr.id_producto = dp.id_producto
       AND pr.id_restaurante = dp.id_restaurante
     WHERE dp.id_pedido = $1 AND dp.id_restaurante = $2
     ORDER BY dp.creado_en, dp.id_detalle`,
    [orderId, restaurantId],
  )
  return result.rows.map(formatOrderDetail)
}

export async function getOrder(orderId, restaurantId, roleCode, userId) {
  const id = normalizeUuid(orderId, 'Order id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const row = await getOrderBase(id, idRestaurant)
  if (!row) throw notFound('Order not found')
  if (roleCode === 'mesero' && row.id_usuario !== userId) throw forbidden('Order not found')
  return { ...formatOrder(row), items: await getDetails(id, idRestaurant) }
}

export async function listOrders(restaurantId, roleCode, userId) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const idUser = normalizeUuid(userId, 'User id')
  const conditions = ['p.id_restaurante = $1']
  const params = [idRestaurant]

  if (roleCode === 'mesero') {
    conditions.push('p.id_usuario = $2')
    params.push(idUser)
  }

  if (roleCode !== 'admin') {
    conditions.push("p.estado NOT IN ('cerrado', 'cancelado')")
  }

  const result = await pool.query(
    `SELECT p.id_pedido, p.id_restaurante, p.id_mesa, p.id_usuario, p.fecha_hora,
            p.estado, p.actualizado_en, m.numero AS mesa_numero, m.estado AS mesa_estado,
            u.nombre AS usuario_nombre,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario)
              FILTER (WHERE dp.estado <> 'cancelado'), 0) AS total
     FROM pedidos p
     JOIN mesas m ON m.id_mesa = p.id_mesa AND m.id_restaurante = p.id_restaurante
     JOIN usuarios u ON u.id_usuario = p.id_usuario AND u.id_restaurante = p.id_restaurante
      LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id_pedido, m.numero, m.estado, u.nombre
     ORDER BY p.fecha_hora DESC`,
    params,
  )

  const orders = []
  for (const row of result.rows) {
    orders.push({ ...formatOrder(row), items: await getDetails(row.id_pedido, idRestaurant) })
  }
  return orders
}

export async function createOrder({ restaurantId, userId, mesaId, items, personas }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const idUser = normalizeUuid(userId, 'User id')
  const idMesa = normalizeUuid(mesaId, 'Table id')
  const ocupadasPersonas = personas === undefined
    ? 1
    : normalizePositiveInteger(personas, 'Número de personas')
  if (!Array.isArray(items) || items.length === 0) throw badRequest('At least one item is required')

  const normalizedItems = items.map((item) => ({
    productId: normalizeUuid(item?.productoId, 'Product id'),
    quantity: normalizeQuantity(item?.cantidad),
    notes: normalizeNotes(item?.notas),
  }))
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const table = await client.query(
      `SELECT id_mesa, estado FROM mesas
       WHERE id_mesa = $1 AND id_restaurante = $2 FOR UPDATE`,
      [idMesa, idRestaurant],
    )
    if (table.rowCount === 0) throw notFound('Table not found')
    if (table.rows[0].estado === 'reservada') throw badRequest('Table is reserved')

    await client.query(
      `UPDATE mesas
       SET estado = 'sin_atender',
           ocupada_desde = COALESCE(ocupada_desde, now()),
           ocupada_personas = $1,
           actualizado_en = now()
       WHERE id_mesa = $2 AND id_restaurante = $3`,
      [ocupadasPersonas, idMesa, idRestaurant],
    )

    const activeOrder = await client.query(
      `SELECT id_pedido FROM pedidos
       WHERE id_mesa = $1 AND id_restaurante = $2
         AND estado NOT IN ('cerrado', 'cancelado')
       LIMIT 1`,
      [idMesa, idRestaurant],
    )
    if (activeOrder.rowCount > 0) throw badRequest('Table already has an active order')

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))]
    const productsResult = await client.query(
      `SELECT id_producto, nombre, precio, disponible
       FROM productos
       WHERE id_producto = ANY($1::uuid[]) AND id_restaurante = $2`,
      [productIds, idRestaurant],
    )
    const productsById = new Map(productsResult.rows.map((product) => [product.id_producto, product]))
    for (const item of normalizedItems) {
      const product = productsById.get(item.productId)
      if (!product) throw notFound('Product not found')
      if (!product.disponible) throw badRequest(`Product ${product.nombre} is unavailable`)
    }

    const orderResult = await client.query(
      `INSERT INTO pedidos (id_restaurante, id_mesa, id_usuario, estado)
       VALUES ($1, $2, $3, 'pendiente')
       RETURNING id_pedido, id_restaurante, id_mesa, id_usuario, fecha_hora,
                 estado, actualizado_en`,
      [idRestaurant, idMesa, idUser],
    )
    const order = orderResult.rows[0]

    for (const item of normalizedItems) {
      const product = productsById.get(item.productId)
      await client.query(
        `INSERT INTO detalles_pedido
          (id_pedido, id_producto, id_restaurante, cantidad, notas, precio_unitario)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id_pedido, item.productId, idRestaurant, item.quantity, item.notes, product.precio],
      )
    }

    await client.query('COMMIT')
    return getOrder(order.id_pedido, idRestaurant)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function recalculateOrderStatus(client, orderId) {
  const result = await client.query(
    `SELECT COUNT(*) AS total_count,
            COUNT(*) FILTER (WHERE estado = 'cancelado') AS canceled_count,
            COUNT(*) FILTER (WHERE estado = 'listo') AS ready_count,
            COUNT(*) FILTER (WHERE estado = 'en_preparacion') AS preparation_count
     FROM detalles_pedido WHERE id_pedido = $1`,
    [orderId],
  )
  const counts = result.rows[0]
  let status = 'pendiente'
  if (Number(counts.canceled_count) === Number(counts.total_count)) status = 'cancelado'
  else if (Number(counts.ready_count) === Number(counts.total_count)) status = 'listo'
  else if (Number(counts.preparation_count) > 0) status = 'en_preparacion'

  await client.query(
    'UPDATE pedidos SET estado = $1, actualizado_en = now() WHERE id_pedido = $2',
    [status, orderId],
  )
  return status
}

export async function addOrderItems({ orderId, restaurantId, userId, items }) {
  const idOrder = normalizeUuid(orderId, 'Order id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const idUser = normalizeUuid(userId, 'User id')
  if (!Array.isArray(items) || items.length === 0) throw badRequest('At least one item is required')

  const nuevosItems = items.map((item) => ({
    productId: normalizeUuid(item?.productoId, 'Product id'),
    quantity: normalizeQuantity(item?.cantidad),
    notes: normalizeNotes(item?.notas),
  }))
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const order = await client.query(
      `SELECT id_pedido, id_mesa
       FROM pedidos
       WHERE id_pedido = $1 AND id_restaurante = $2 AND id_usuario = $3
         AND estado NOT IN ('cerrado', 'cancelado')
       FOR UPDATE`,
      [idOrder, idRestaurant, idUser],
    )
    if (order.rowCount === 0) throw notFound('Order not found')

    const productIds = [...new Set(nuevosItems.map((item) => item.productId))]
    const productsResult = await client.query(
      `SELECT id_producto, nombre, precio, disponible
       FROM productos
       WHERE id_producto = ANY($1::uuid[]) AND id_restaurante = $2`,
      [productIds, idRestaurant],
    )
    const productosPorId = new Map(productsResult.rows.map((producto) => [producto.id_producto, producto]))
    for (const item of nuevosItems) {
      const producto = productosPorId.get(item.productId)
      if (!producto) throw notFound('Product not found')
      if (!producto.disponible) throw badRequest(`Product ${producto.nombre} is unavailable`)
    }

    for (const item of nuevosItems) {
      const producto = productosPorId.get(item.productId)
      await client.query(
        `INSERT INTO detalles_pedido
          (id_pedido, id_producto, id_restaurante, cantidad, notas, precio_unitario)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idOrder, item.productId, idRestaurant, item.quantity, item.notes, producto.precio],
      )
    }

    await client.query(
      `UPDATE mesas
       SET estado = 'sin_atender', ocupada_desde = now(), actualizado_en = now()
       WHERE id_mesa = $1 AND id_restaurante = $2 AND estado = 'atendida'`,
      [order.rows[0].id_mesa, idRestaurant],
    )
    await recalculateOrderStatus(client, idOrder)
    await client.query('COMMIT')
    return getOrder(idOrder, idRestaurant)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateOrderItem({ orderId, itemId, restaurantId, quantity, notes, cancel = false }) {
  const idOrder = normalizeUuid(orderId, 'Order id')
  const idItem = normalizeUuid(itemId, 'Item id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const item = await client.query(
      `SELECT dp.id_detalle, dp.estado, dp.cantidad, dp.notas, p.id_usuario
       FROM detalles_pedido dp
       JOIN pedidos p ON p.id_pedido = dp.id_pedido
       WHERE dp.id_detalle = $1 AND dp.id_restaurante = $2
       FOR UPDATE`,
      [idItem, idRestaurant],
    )
    if (item.rowCount === 0) throw notFound('Order item not found')
    if (item.rows[0].estado === 'en_preparacion' || item.rows[0].estado === 'listo') {
      throw badRequest('Item is already being prepared')
    }

    if (cancel) {
      await client.query(
        `UPDATE detalles_pedido SET estado = 'cancelado', actualizado_en = now()
         WHERE id_detalle = $1`,
        [idItem],
      )
    } else {
      const normalizedQuantity = normalizeQuantity(quantity)
      const normalizedNotes = normalizeNotes(notes)
      await client.query(
        `UPDATE detalles_pedido SET cantidad = $1, notas = $2, actualizado_en = now()
         WHERE id_detalle = $3`,
        [normalizedQuantity, normalizedNotes, idItem],
      )
    }

    await recalculateOrderStatus(client, idOrder)
    await client.query('COMMIT')
    return getOrder(idOrder, idRestaurant)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateOrderItemStatus({ orderId, itemId, restaurantId, status }) {
  const idOrder = normalizeUuid(orderId, 'Order id')
  const idItem = normalizeUuid(itemId, 'Item id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const allowed = { pendiente: ['en_preparacion'], en_preparacion: ['listo'], listo: [] }
  const normalizedStatus = status?.trim()?.toLowerCase()
  if (!Object.hasOwn(allowed, normalizedStatus)) throw badRequest('Item status is invalid')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const item = await client.query(
      `SELECT estado FROM detalles_pedido
       WHERE id_detalle = $1 AND id_restaurante = $2 FOR UPDATE`,
      [idItem, idRestaurant],
    )
    if (item.rowCount === 0) throw notFound('Order item not found')
    if (!allowed[item.rows[0].estado].includes(normalizedStatus)) {
      throw badRequest('Item status transition is invalid')
    }

    await client.query(
      `UPDATE detalles_pedido SET estado = $1, actualizado_en = now()
       WHERE id_detalle = $2`,
      [normalizedStatus, idItem],
    )
    await recalculateOrderStatus(client, idOrder)
    await client.query('COMMIT')
    return getOrder(idOrder, idRestaurant)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
