import { pool } from '../db/pool.js'
import { badRequest } from '../utils/errors.js'

export async function getRolesForUser(queryable, userId, businessId) {
  const result = await queryable.query(
    `SELECT r.id, r.code, r.name, r.description
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND ur.business_id = $2
     ORDER BY r.code`,
    [userId, businessId],
  )

  return result.rows
}

export async function listRoles() {
  const result = await pool.query(
    `SELECT id, code, name, description
     FROM roles
     ORDER BY code`,
  )
  return result.rows
}

export async function requireRolesExist(queryable, roleCodes) {
  const result = await queryable.query(
    'SELECT code FROM roles WHERE code = ANY($1::text[])',
    [roleCodes],
  )
  const found = new Set(result.rows.map((role) => role.code))
  const missing = roleCodes.filter((roleCode) => !found.has(roleCode))

  if (missing.length > 0) {
    throw badRequest('One or more roles do not exist', { missing })
  }
}
