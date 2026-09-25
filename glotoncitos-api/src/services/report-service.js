import { pool } from '../db/pool.js'
import { normalizeUuid } from '../utils/validation.js'

function buildDateParams(baseParams, dateFrom, dateTo) {
  let index = baseParams.length
  const conditions = []
  if (dateFrom) {
    index += 1
    conditions.push(`p.fecha_hora >= $${index}`)
    baseParams.push(new Date(dateFrom))
  }
  if (dateTo) {
    index += 1
    conditions.push(`p.fecha_hora <= $${index}`)
    baseParams.push(new Date(dateTo))
  }
  return conditions
}

export async function getSalesSummary({ restaurantId, dateFrom, dateTo }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const whereClause = ['p.id_restaurante = $1', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT COALESCE(COUNT(DISTINCT p.id_pedido), 0) AS total_orders,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS total_revenue,
            COALESCE(AVG(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS avg_order_value
     FROM pedidos p
     LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
     WHERE ${whereClause}`,
    params,
  )
  const row = result.rows[0]
  return {
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
    avgOrderValue: Number(row.avg_order_value),
  }
}

export async function getSalesByMonth({ restaurantId, dateFrom, dateTo }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const whereClause = ['p.id_restaurante = $1', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT to_char(p.fecha_hora, 'YYYY-MM') AS sale_month,
            COUNT(DISTINCT p.id_pedido) AS orders,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS revenue
      FROM pedidos p
      LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
      WHERE ${whereClause}
      GROUP BY to_char(p.fecha_hora, 'YYYY-MM')
      ORDER BY sale_month`,
    params,
  )
  return result.rows.map((row) => ({
    month: row.sale_month,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
  }))
}

export async function getSalesByDate({ restaurantId, dateFrom, dateTo }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const whereClause = ['p.id_restaurante = $1', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT DATE(p.fecha_hora) AS sale_date,
            COUNT(DISTINCT p.id_pedido) AS orders,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS revenue
     FROM pedidos p
     LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
     WHERE ${whereClause}
     GROUP BY DATE(p.fecha_hora)
     ORDER BY sale_date`,
    params,
  )
  return result.rows.map((row) => ({
    date: row.sale_date,
    orders: Number(row.orders),
    revenue: Number(row.revenue),
  }))
}

export async function getTopProducts({ restaurantId, dateFrom, dateTo, limit = 10 }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const whereClause = ['dp.id_restaurante = $1', 'dp.estado <> \'cancelado\'', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT pr.id_producto, pr.nombre AS product_name,
            SUM(dp.cantidad) AS total_quantity,
            SUM(dp.cantidad * dp.precio_unitario) AS total_revenue
     FROM detalles_pedido dp
     JOIN pedidos p ON p.id_pedido = dp.id_pedido AND p.id_restaurante = dp.id_restaurante
     JOIN productos pr ON pr.id_producto = dp.id_producto AND pr.id_restaurante = dp.id_restaurante
     WHERE ${whereClause}
     GROUP BY pr.id_producto, pr.nombre
     ORDER BY total_quantity DESC
      LIMIT $${params.length + 1}`,
    [...params, limit],
  )
  return result.rows.map((row) => ({
    productId: row.id_producto,
    productName: row.product_name,
    totalQuantity: Number(row.total_quantity),
    totalRevenue: Number(row.total_revenue),
  }))
}

export async function getTableTurnover({ restaurantId, dateFrom, dateTo }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const joinConditions = ['p.id_restaurante = $1', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT m.id_mesa, m.numero AS table_number,
            COUNT(DISTINCT p.id_pedido) AS total_orders,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS total_revenue
     FROM mesas m
     LEFT JOIN pedidos p ON p.id_mesa = m.id_mesa AND p.id_restaurante = m.id_restaurante AND ${joinConditions}
     LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
     WHERE m.id_restaurante = $1
     GROUP BY m.id_mesa, m.numero
     ORDER BY total_orders DESC`,
    params,
  )
  return result.rows.map((row) => ({
    tableId: row.id_mesa,
    tableNumber: row.table_number,
    totalOrders: Number(row.total_orders),
    totalRevenue: Number(row.total_revenue),
  }))
}

export async function getWorkerStats({ restaurantId, dateFrom, dateTo }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const params = [idRestaurant]
  const dateConditions = buildDateParams(params, dateFrom, dateTo)
  const whereClause = ['p.id_restaurante = $1', ...dateConditions].join(' AND ')

  const result = await pool.query(
    `SELECT p.id_usuario, u.nombre AS worker_name,
            COUNT(DISTINCT p.id_pedido) AS orders,
            COALESCE(SUM(dp.cantidad * dp.precio_unitario) FILTER (WHERE dp.estado <> 'cancelado'), 0) AS total_revenue
     FROM pedidos p
     JOIN usuarios u ON u.id_usuario = p.id_usuario AND u.id_restaurante = p.id_restaurante
     LEFT JOIN detalles_pedido dp ON dp.id_pedido = p.id_pedido AND dp.id_restaurante = p.id_restaurante
     WHERE ${whereClause}
     GROUP BY p.id_usuario, u.nombre
     ORDER BY orders DESC`,
    params,
  )
  return result.rows.map((row) => ({
    userId: row.id_usuario,
    workerName: row.worker_name,
    orders: Number(row.orders),
    totalRevenue: Number(row.total_revenue),
  }))
}
