import { pool } from '../db/pool.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import {
  normalizePositiveInteger,
  normalizeTableStatus,
  normalizeUuid,
} from '../utils/validation.js'

export function formatTable(row) {
  return {
    id: row.id_mesa,
    restaurantId: row.id_restaurante,
    number: row.numero,
    capacity: row.capacidad,
    status: row.estado,
    occupiedSince: row.ocupada_desde,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }
}

export async function listTables(restaurantId) {
  const id = normalizeUuid(restaurantId, 'Restaurant id')
  const result = await pool.query(
    `SELECT id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde,
            creado_en, actualizado_en
     FROM mesas
     WHERE id_restaurante = $1
     ORDER BY numero`,
    [id],
  )
  return result.rows.map(formatTable)
}

export async function createTable({ restaurantId, number, capacity = 1 }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const normalizedNumber = normalizePositiveInteger(number, 'Table number')
  const normalizedCapacity = normalizePositiveInteger(capacity, 'Capacity')
  const restaurant = await pool.query(
    'SELECT id_restaurante FROM restaurantes WHERE id_restaurante = $1 AND estado_suscripcion = $2',
    [idRestaurant, 'activa'],
  )
  if (restaurant.rowCount === 0) throw notFound('Restaurant not found')

  try {
    const result = await pool.query(
      `INSERT INTO mesas (id_restaurante, numero, capacidad)
       VALUES ($1, $2, $3)
       RETURNING id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde,
                 creado_en, actualizado_en`,
      [idRestaurant, normalizedNumber, normalizedCapacity],
    )
    return formatTable(result.rows[0])
  } catch (error) {
    if (error?.code === '23505') throw conflict('Table number already exists')
    throw error
  }
}

export async function updateTable(tableId, restaurantId, updates) {
  const id = normalizeUuid(tableId, 'Table id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const current = await pool.query(
    `SELECT id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde
     FROM mesas WHERE id_mesa = $1 AND id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (current.rowCount === 0) throw notFound('Table not found')

  const table = current.rows[0]
  const number = updates.number === undefined
    ? table.numero
    : normalizePositiveInteger(updates.number, 'Table number')
  const capacity = updates.capacity === undefined
    ? table.capacidad
    : normalizePositiveInteger(updates.capacity, 'Capacity')
  const status = updates.status === undefined ? table.estado : normalizeTableStatus(updates.status)

  try {
    const result = await pool.query(
      `UPDATE mesas
       SET numero = $1, capacidad = $2, estado = $3, actualizado_en = now()
       WHERE id_mesa = $4 AND id_restaurante = $5
       RETURNING id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde,
                 creado_en, actualizado_en`,
      [number, capacity, status, id, idRestaurant],
    )
    return formatTable(result.rows[0])
  } catch (error) {
    if (error?.code === '23505') throw conflict('Table number already exists')
    throw error
  }
}

export async function updateTableStatus(tableId, restaurantId, userId, status) {
  const id = normalizeUuid(tableId, 'Table id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const normalizedStatus = normalizeTableStatus(status)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const table = await client.query(
      `SELECT id_mesa, id_restaurante, estado, ocupada_desde
       FROM mesas WHERE id_mesa = $1 AND id_restaurante = $2
       FOR UPDATE`,
      [id, idRestaurant],
    )
    if (table.rowCount === 0) throw notFound('Table not found')

    const current = table.rows[0]
    if (current.estado === normalizedStatus) {
      await client.query('COMMIT')
      return formatTable(current)
    }

    if (normalizedStatus === 'libre') {
      const activeOrder = await client.query(
        `SELECT id_pedido FROM pedidos
         WHERE id_mesa = $1 AND id_restaurante = $2
           AND estado NOT IN ('cerrado', 'cancelado')
         LIMIT 1`,
        [id, idRestaurant],
      )
      if (activeOrder.rowCount > 0) {
        throw badRequest('The table has an active order')
      }
    }

    const occupiedSince = normalizedStatus === 'ocupada' ? new Date() : null
    const result = await client.query(
      `UPDATE mesas
       SET estado = $1, ocupada_desde = $2, actualizado_en = now()
       WHERE id_mesa = $3 AND id_restaurante = $4
       RETURNING id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde,
                 creado_en, actualizado_en`,
      [normalizedStatus, occupiedSince, id, idRestaurant],
    )
    await client.query('COMMIT')
    return formatTable(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function deleteTable(tableId, restaurantId) {
  const id = normalizeUuid(tableId, 'Table id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  try {
    const result = await pool.query('DELETE FROM mesas WHERE id_mesa = $1 AND id_restaurante = $2', [id, idRestaurant])
    if (result.rowCount === 0) throw notFound('Table not found')
  } catch (error) {
    if (error?.code === '23503') throw conflict('Table is in use')
    throw error
  }
}

export async function getTable(tableId, restaurantId) {
  const id = normalizeUuid(tableId, 'Table id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const result = await pool.query(
    `SELECT id_mesa, id_restaurante, numero, capacidad, estado, ocupada_desde,
            creado_en, actualizado_en
     FROM mesas WHERE id_mesa = $1 AND id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (result.rowCount === 0) throw notFound('Table not found')
  return formatTable(result.rows[0])
}
