import bcrypt from 'bcryptjs'
import { pool } from '../db/pool.js'
import { conflict, notFound } from '../utils/errors.js'
import { normalizeEmail, normalizeRoleCodes, validatePassword } from '../utils/validation.js'
import { getRolesForUser, requireRolesExist } from './roles-service.js'

export async function createUser({ email, password, roleCodes, businessId, createdBy }) {
  const normalizedEmail = normalizeEmail(email)
  const passwordHash = await bcrypt.hash(validatePassword(password), 12)
  const roles = normalizeRoleCodes(roleCodes)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const businessResult = await client.query(
      'SELECT id FROM businesses WHERE id = $1',
      [businessId],
    )
    if (businessResult.rowCount === 0) throw notFound('Business not found')

    await requireRolesExist(client, roles)

    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail],
    )
    if (existing.rowCount > 0) throw conflict('Email is already registered')

    const userResult = await client.query(
      `INSERT INTO users (business_id, email, password_hash, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, is_active, created_at`,
      [businessId, normalizedEmail, passwordHash, createdBy],
    )
    const user = userResult.rows[0]

    for (const roleCode of roles) {
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE code = $1',
        [roleCode],
      )
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, business_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [user.id, roleResult.rows[0].id, businessId, createdBy],
      )
    }

    await client.query('COMMIT')
    const assignedRoles = await getRolesForUser(pool, user.id, businessId)

    return {
      id: user.id,
      email: user.email,
      is_active: user.is_active,
      roles: assignedRoles,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listUsers(businessId) {
  const result = await pool.query(
    `SELECT id, email, is_active, created_at, updated_at
     FROM users
     WHERE business_id = $1
     ORDER BY created_at, email`,
    [businessId],
  )

  const users = []
  for (const user of result.rows) {
    users.push({
      ...user,
      roles: await getRolesForUser(pool, user.id, businessId),
    })
  }

  return users
}
