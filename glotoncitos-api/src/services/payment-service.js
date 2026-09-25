import { pool } from '../db/pool.js'
import { badRequest, notFound } from '../utils/errors.js'
import { normalizePaymentMethod, normalizeUuid } from '../utils/validation.js'

export function formatPayment(row) {
  return {
    id: row.id_pago,
    orderId: row.id_pedido,
    total: Number(row.total),
    method: row.metodo_pago,
    status: row.estado,
    date: row.fecha,
    userId: row.id_usuario,
    createdAt: row.creado_en,
  }
}

export async function createPayment({ orderId, method, userId, restaurantId }) {
  const idOrder = normalizeUuid(orderId, 'Order id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const normalizedMethod = normalizePaymentMethod(method)
  const idUser = userId ? normalizeUuid(userId, 'User id') : null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const order = await client.query(
      `SELECT p.id_pedido, p.id_restaurante, p.id_mesa, p.id_usuario, p.fecha_hora,
              p.estado, p.actualizado_en, m.numero AS mesa_numero, m.id_mesa AS mesa_id
       FROM pedidos p
       JOIN mesas m ON m.id_mesa = p.id_mesa AND m.id_restaurante = p.id_restaurante
       WHERE p.id_pedido = $1 AND p.id_restaurante = $2 FOR UPDATE`,
      [idOrder, idRestaurant],
    )
    if (order.rowCount === 0) throw notFound('Order not found')

    const orderRow = order.rows[0]
    if (orderRow.estado !== 'listo') {
      throw badRequest('Order is not ready for payment')
    }

    const detailsResult = await client.query(
      `SELECT COALESCE(SUM(cantidad * precio_unitario) FILTER (WHERE estado <> 'cancelado'), 0) AS total
       FROM detalles_pedido
       WHERE id_pedido = $1 AND id_restaurante = $2`,
      [idOrder, idRestaurant],
    )
    const authoritativeTotal = Number(detailsResult.rows[0].total)

    const paymentResult = await client.query(
      `INSERT INTO pagos (id_pedido, total, metodo_pago, estado, id_usuario)
       VALUES ($1, $2, $3, 'pagado', $4)
       RETURNING id_pago, id_pedido, total, metodo_pago, estado, fecha, id_usuario, creado_en`,
      [idOrder, authoritativeTotal, normalizedMethod, idUser],
    )

    await client.query(
      "UPDATE pedidos SET estado = 'cerrado', actualizado_en = now() WHERE id_pedido = $1",
      [idOrder],
    )

    await client.query(
      `UPDATE mesas SET estado = 'libre', ocupada_desde = NULL, actualizado_en = now()
       WHERE id_mesa = $1 AND id_restaurante = $2`,
      [orderRow.mesa_id, idRestaurant],
    )

    await client.query('COMMIT')

    return {
      payment: formatPayment(paymentResult.rows[0]),
      order: {
        id: orderRow.id_pedido,
        restaurantId: orderRow.id_restaurante,
        table: {
          id: orderRow.mesa_id,
          number: orderRow.mesa_numero,
        },
        status: 'cerrado',
        createdAt: orderRow.fecha_hora,
        updatedAt: orderRow.actualizado_en,
        total: authoritativeTotal,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listPayments({ restaurantId, dateFrom, dateTo, method }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const conditions = ['p.id_restaurante = $1']
  const params = [idRestaurant]
  let paramIndex = 1

  if (dateFrom) {
    paramIndex += 1
    conditions.push(`pg.fecha >= $${paramIndex}`)
    params.push(new Date(dateFrom))
  }
  if (dateTo) {
    paramIndex += 1
    conditions.push(`pg.fecha <= $${paramIndex}`)
    params.push(new Date(dateTo))
  }
  if (method) {
    paramIndex += 1
    conditions.push(`pg.metodo_pago = $${paramIndex}`)
    params.push(method)
  }
  const whereClause = conditions.join(' AND ')

  const result = await pool.query(
    `SELECT pg.id_pago, pg.id_pedido, pg.total, pg.metodo_pago, pg.estado, pg.fecha,
            pg.id_usuario, pg.creado_en
     FROM pagos pg
     JOIN pedidos p ON p.id_pedido = pg.id_pedido
     WHERE ${whereClause}
     ORDER BY pg.fecha DESC`,
    params,
  )
  return result.rows.map(formatPayment)
}
