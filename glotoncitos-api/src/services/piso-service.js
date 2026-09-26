import { pool } from '../db/pool.js'
import { conflict, notFound } from '../utils/errors.js'
import { normalizePositiveInteger, normalizeUuid } from '../utils/validation.js'

export function formatearPiso(fila) {
  return {
    id: fila.id_piso,
    idRestaurante: fila.id_restaurante,
    numero: fila.numero,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  }
}

export async function listarPisos(idRestaurante) {
  const id = normalizeUuid(idRestaurante, 'Id del restaurante')
  const resultado = await pool.query(
    `SELECT id_piso, id_restaurante, numero, creado_en, actualizado_en
     FROM pisos
     WHERE id_restaurante = $1
     ORDER BY numero`,
    [id],
  )
  return resultado.rows.map(formatearPiso)
}

export async function crearPiso({ idRestaurante, numero }) {
  const id = normalizeUuid(idRestaurante, 'Id del restaurante')
  const numeroPiso = normalizePositiveInteger(numero, 'Número de piso')
  const restaurante = await pool.query(
    'SELECT id_restaurante FROM restaurantes WHERE id_restaurante = $1 AND estado_suscripcion = $2',
    [id, 'activa'],
  )
  if (restaurante.rowCount === 0) throw notFound('Restaurante no encontrado')

  try {
    const resultado = await pool.query(
      `INSERT INTO pisos (id_restaurante, numero)
       VALUES ($1, $2)
       RETURNING id_piso, id_restaurante, numero, creado_en, actualizado_en`,
      [id, numeroPiso],
    )
    return formatearPiso(resultado.rows[0])
  } catch (error) {
    if (error?.code === '23505') throw conflict('El número de piso ya existe')
    throw error
  }
}
