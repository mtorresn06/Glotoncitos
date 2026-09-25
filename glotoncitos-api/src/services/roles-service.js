import { pool } from '../db/pool.js'
import { badRequest, notFound } from '../utils/errors.js'

export function formatRole(row) {
  return {
    id: row.id_rol,
    code: row.codigo,
    name: row.nombre,
    description: row.descripcion,
  }
}

export async function getRoleByCode(queryable, code) {
  const result = await queryable.query(
    'SELECT id_rol, codigo, nombre, descripcion FROM roles WHERE codigo = $1',
    [code],
  )
  return result.rows[0] || null
}

export async function getRoleForUser(queryable, userId, restaurantId) {
  const result = await queryable.query(
    `SELECT r.id_rol, r.codigo, r.nombre, r.descripcion
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = $1 AND u.id_restaurante = $2`,
    [userId, restaurantId],
  )
  return result.rows[0] || null
}

export async function listRoles() {
  const result = await pool.query(
    `SELECT id_rol, codigo, nombre, descripcion
     FROM roles
     ORDER BY codigo`,
  )
  return result.rows.map(formatRole)
}

export async function requireRoleExists(queryable, roleCode) {
  const role = await getRoleByCode(queryable, roleCode)
  if (!role) throw badRequest('Role does not exist', { roleCode })
  return role
}

export async function getUserRole(userId, restaurantId) {
  const role = await getRoleForUser(pool, userId, restaurantId)
  if (!role) throw notFound('User role not found')
  return formatRole(role)
}
