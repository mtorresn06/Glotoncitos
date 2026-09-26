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
    idPiso: row.id_piso,
    piso: row.piso_numero,
    pedidoListo: Boolean(row.pedido_listo),
    occupiedSince: row.ocupada_desde,
    ocupadaPersonas: row.ocupada_personas,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }
}

export async function listTables(restaurantId) {
  const id = normalizeUuid(restaurantId, 'Restaurant id')
  const result = await pool.query(
    `SELECT m.id_mesa, m.id_restaurante, m.numero, m.capacidad, m.estado, m.ocupada_desde,
            m.ocupada_personas, m.id_piso, p.numero AS piso_numero,
            EXISTS (
              SELECT 1 FROM pedidos pe
              WHERE pe.id_mesa = m.id_mesa
                AND pe.id_restaurante = m.id_restaurante
                AND pe.estado = 'listo'
            ) AS pedido_listo,
            m.creado_en, m.actualizado_en
     FROM mesas m
     JOIN pisos p ON p.id_piso = m.id_piso AND p.id_restaurante = m.id_restaurante
     WHERE m.id_restaurante = $1
     ORDER BY p.numero, m.numero`,
    [id],
  )
  return result.rows.map(formatTable)
}

export async function createTable({ restaurantId, number, capacity = 1, idPiso }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const normalizedNumber = normalizePositiveInteger(number, 'Número de mesa')
  const normalizedCapacity = normalizePositiveInteger(capacity, 'Capacidad')
  const restaurant = await pool.query(
    'SELECT id_restaurante FROM restaurantes WHERE id_restaurante = $1 AND estado_suscripcion = $2',
    [idRestaurant, 'activa'],
  )
  if (restaurant.rowCount === 0) throw notFound('Restaurant not found')

  const piso = idPiso
    ? await pool.query(
      `SELECT id_piso, numero FROM pisos WHERE id_piso = $1 AND id_restaurante = $2`,
      [normalizeUuid(idPiso, 'Id del piso'), idRestaurant],
    )
    : await pool.query(
      `SELECT id_piso, numero FROM pisos WHERE id_restaurante = $1 ORDER BY numero LIMIT 1`,
      [idRestaurant],
    )
  if (piso.rowCount === 0) throw notFound('Piso no encontrado')

  try {
    const result = await pool.query(
      `INSERT INTO mesas (id_restaurante, id_piso, numero, capacidad)
       VALUES ($1, $2, $3, $4)
       RETURNING id_mesa, id_restaurante, id_piso, numero, capacidad, estado, ocupada_desde,
                 ocupada_personas, creado_en, actualizado_en`,
      [idRestaurant, piso.rows[0].id_piso, normalizedNumber, normalizedCapacity],
    )
    return formatTable({ ...result.rows[0], piso_numero: piso.rows[0].numero })
  } catch (error) {
    if (error?.code === '23505') throw conflict('El número de mesa ya existe en el piso')
    throw error
  }
}

export async function updateTable(tableId, restaurantId, updates) {
  const id = normalizeUuid(tableId, 'Table id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const current = await pool.query(
    `SELECT m.id_mesa, m.id_restaurante, m.id_piso, m.numero, m.capacidad, m.estado, m.ocupada_desde,
            m.ocupada_personas, p.numero AS piso_numero
     FROM mesas m
     JOIN pisos p ON p.id_piso = m.id_piso AND p.id_restaurante = m.id_restaurante
     WHERE m.id_mesa = $1 AND m.id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (current.rowCount === 0) throw notFound('Table not found')

  const table = current.rows[0]
  const idPisoSeleccionado = updates.idPiso === undefined
    ? table.id_piso
    : normalizeUuid(updates.idPiso, 'Id del piso')
  const number = updates.number === undefined
    ? table.numero
    : normalizePositiveInteger(updates.number, 'Table number')
  const capacity = updates.capacity === undefined
    ? table.capacidad
    : normalizePositiveInteger(updates.capacity, 'Capacity')
  const status = updates.status === undefined ? table.estado : normalizeTableStatus(updates.status)

  try {
    await pool.query(
      `UPDATE mesas
       SET numero = $1, capacidad = $2, estado = $3, id_piso = $4, actualizado_en = now()
       WHERE id_mesa = $5 AND id_restaurante = $6
         AND EXISTS (
           SELECT 1 FROM pisos p
           WHERE p.id_piso = $4 AND p.id_restaurante = $6
         )`,
      [number, capacity, status, idPisoSeleccionado, id, idRestaurant],
    )
    return getTable(id, idRestaurant)
  } catch (error) {
    if (error?.code === '23505') throw conflict('El número de mesa ya existe en el piso')
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
      `SELECT id_mesa, id_restaurante, id_piso, estado, ocupada_desde, ocupada_personas
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

    if (normalizedStatus === 'atendida') {
      const readyOrder = await client.query(
        `SELECT id_pedido FROM pedidos
         WHERE id_mesa = $1 AND id_restaurante = $2 AND estado = 'listo'
         LIMIT 1`,
        [id, idRestaurant],
      )
      if (readyOrder.rowCount === 0) throw badRequest('The table does not have a ready order')
    }

    const result = await client.query(
      `UPDATE mesas
       SET estado = $1,
           ocupada_desde = CASE
             WHEN $1 = 'libre' THEN NULL
             WHEN $1 = 'sin_atender' THEN COALESCE(ocupada_desde, now())
             ELSE ocupada_desde
           END,
           ocupada_personas = CASE WHEN $1 = 'libre' THEN NULL ELSE ocupada_personas END,
           actualizado_en = now()
       WHERE id_mesa = $2 AND id_restaurante = $3
       RETURNING id_mesa, id_restaurante, id_piso, numero, capacidad, estado, ocupada_desde,
                 ocupada_personas, creado_en, actualizado_en`,
      [normalizedStatus, id, idRestaurant],
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

export async function cancelarMesa(mesaId, restaurantId) {
  const id = normalizeUuid(mesaId, 'Id de mesa')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const mesa = await client.query(
      'SELECT id_mesa FROM mesas WHERE id_mesa = $1 AND id_restaurante = $2 FOR UPDATE',
      [id, idRestaurant],
    )
    if (mesa.rowCount === 0) throw notFound('Mesa no encontrada')

    const pedido = await client.query(
      `SELECT id_pedido FROM pedidos
       WHERE id_mesa = $1 AND id_restaurante = $2 AND estado NOT IN ('cerrado', 'cancelado')
       FOR UPDATE`,
      [id, idRestaurant],
    )
    if (pedido.rowCount > 0) {
      await client.query(
        `UPDATE detalles_pedido SET estado = 'cancelado', actualizado_en = now() WHERE id_pedido = $1`,
        [pedido.rows[0].id_pedido],
      )
      await client.query(
        `UPDATE pedidos SET estado = 'cancelado', actualizado_en = now() WHERE id_pedido = $1`,
        [pedido.rows[0].id_pedido],
      )
    }

    await client.query(
      `UPDATE mesas
       SET estado = 'libre', ocupada_desde = NULL, ocupada_personas = NULL, actualizado_en = now()
       WHERE id_mesa = $1 AND id_restaurante = $2`,
      [id, idRestaurant],
    )
    await client.query('COMMIT')
    return getTable(id, idRestaurant)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function cambiarMesaOrden({ mesaOrigenId, mesaDestinoId, restaurantId }) {
  const idOrigen = normalizeUuid(mesaOrigenId, 'Id de mesa de origen')
  const idDestino = normalizeUuid(mesaDestinoId, 'Id de mesa de destino')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  if (idOrigen === idDestino) throw badRequest('La mesa destino debe ser diferente')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const mesas = await client.query(
      `SELECT id_mesa, estado, ocupada_desde, ocupada_personas
       FROM mesas
       WHERE id_restaurante = $1 AND id_mesa = ANY($2::uuid[])
       ORDER BY id_mesa
       FOR UPDATE`,
      [idRestaurant, [idOrigen, idDestino]],
    )
    if (mesas.rowCount !== 2) throw notFound('Mesa no encontrada')

    const origen = mesas.rows.find((mesa) => mesa.id_mesa === idOrigen)
    const destino = mesas.rows.find((mesa) => mesa.id_mesa === idDestino)
    if (destino.estado !== 'libre') throw badRequest('La mesa destino no está disponible')

    const pedido = await client.query(
      `SELECT id_pedido FROM pedidos
       WHERE id_mesa = $1 AND id_restaurante = $2 AND estado NOT IN ('cerrado', 'cancelado')
       LIMIT 1 FOR UPDATE`,
      [idOrigen, idRestaurant],
    )
    if (pedido.rowCount === 0) throw badRequest('La mesa origen no tiene una orden activa')

    const pedidoExistente = await client.query(
      `SELECT id_pedido FROM pedidos
       WHERE id_mesa = $1 AND id_restaurante = $2 AND estado NOT IN ('cerrado', 'cancelado')
       LIMIT 1`,
      [idDestino, idRestaurant],
    )
    if (pedidoExistente.rowCount > 0) throw badRequest('La mesa destino ya tiene una orden activa')

    await client.query(
      'UPDATE pedidos SET id_mesa = $1, actualizado_en = now() WHERE id_pedido = $2',
      [idDestino, pedido.rows[0].id_pedido],
    )
    await client.query(
      `UPDATE mesas
       SET estado = 'libre', ocupada_desde = NULL, ocupada_personas = NULL, actualizado_en = now()
       WHERE id_mesa = $1 AND id_restaurante = $2`,
      [idOrigen, idRestaurant],
    )
    await client.query(
      `UPDATE mesas
       SET estado = 'sin_atender', ocupada_desde = $1, ocupada_personas = $2, actualizado_en = now()
       WHERE id_mesa = $3 AND id_restaurante = $4`,
      [origen.ocupada_desde || new Date(), origen.ocupada_personas, idDestino, idRestaurant],
    )
    await client.query('COMMIT')
    return getTable(idDestino, idRestaurant)
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
    `SELECT m.id_mesa, m.id_restaurante, m.id_piso, m.numero, m.capacidad, m.estado, m.ocupada_desde,
            m.ocupada_personas, p.numero AS piso_numero,
            EXISTS (
              SELECT 1 FROM pedidos pe
              WHERE pe.id_mesa = m.id_mesa
                AND pe.id_restaurante = m.id_restaurante
                AND pe.estado = 'listo'
            ) AS pedido_listo,
            m.creado_en, m.actualizado_en
     FROM mesas m
     JOIN pisos p ON p.id_piso = m.id_piso AND p.id_restaurante = m.id_restaurante
     WHERE m.id_mesa = $1 AND m.id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (result.rowCount === 0) throw notFound('Table not found')
  return formatTable(result.rows[0])
}
