import bcrypt from 'bcryptjs'
import { pool } from '../db/pool.js'
import { conflict, forbidden, notFound } from '../utils/errors.js'
import {
  normalizeGlotoncitosEmail,
  normalizeName,
  normalizePassword,
  normalizeRoleCode,
} from '../utils/validation.js'
import { getRoleByCode } from './roles-service.js'

export function formatUser(row) {
  const role = row.id_rol
    ? {
        id: row.id_rol,
        code: row.role_code,
        name: row.role_name,
        description: row.role_description,
      }
    : null

  return {
    id: row.id_usuario,
    name: row.nombre,
    email: row.correo,
    active: row.estado,
    restaurantId: row.id_restaurante,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
    role,
    roles: role ? [role] : [],
  }
}

async function getUserRow(userId, restaurantId) {
  const result = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.creado_en, u.actualizado_en,
            u.id_restaurante, r.id_rol, r.codigo AS role_code, r.nombre AS role_name,
            r.descripcion AS role_description
     FROM usuarios u
     LEFT JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = $1 AND u.id_restaurante = $2`,
    [userId, restaurantId],
  )
  return result.rows[0] || null
}

export async function listUsers(restaurantId) {
  const result = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.creado_en, u.actualizado_en,
            u.id_restaurante, r.id_rol, r.codigo AS role_code, r.nombre AS role_name,
            r.descripcion AS role_description
     FROM usuarios u
     LEFT JOIN roles r ON r.id_rol = u.id_rol
     WHERE u.id_restaurante = $1
     ORDER BY u.nombre, u.correo`,
    [restaurantId],
  )
  return result.rows.map(formatUser)
}

export async function createUser({ name, email, password, roleCode, restaurantId, createdBy }) {
  const normalizedName = normalizeName(name, 'Name')
  const normalizedEmail = normalizeGlotoncitosEmail(email)
  const normalizedPassword = normalizePassword(password)
  const normalizedRoleCode = normalizeRoleCode(roleCode)
  if (normalizedRoleCode === 'admin') throw forbidden('Cannot create admin users')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const restaurant = await client.query(
      'SELECT id_restaurante FROM restaurantes WHERE id_restaurante = $1 AND estado_suscripcion = $2',
      [restaurantId, 'activa'],
    )
    if (restaurant.rowCount === 0) throw notFound('Restaurant not found')

    const creator = await client.query(
      'SELECT id_usuario FROM usuarios WHERE id_usuario = $1 AND id_restaurante = $2 AND estado = true',
      [createdBy, restaurantId],
    )
    if (creator.rowCount === 0) throw forbidden()

    const role = await getRoleByCode(client, normalizedRoleCode)
    if (!role) throw notFound('Role not found')

    const existing = await client.query(
      'SELECT id_usuario FROM usuarios WHERE correo = $1',
      [normalizedEmail],
    )
    if (existing.rowCount > 0) throw conflict('Email is already registered')

    const passwordHash = await bcrypt.hash(normalizedPassword, 12)
    const result = await client.query(
      `INSERT INTO usuarios
        (nombre, correo, password_hash, id_rol, id_restaurante, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_usuario, nombre, correo, estado, creado_en, actualizado_en,
                 id_restaurante, id_rol`,
      [normalizedName, normalizedEmail, passwordHash, role.id_rol, restaurantId, createdBy],
    )

    await client.query('COMMIT')
    const row = await getUserRow(result.rows[0].id_usuario, restaurantId)
    return formatUser(row)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateUser(userId, restaurantId, updates) {
  const name = updates.name === undefined ? null : normalizeName(updates.name, 'Name')
  const email = updates.email === undefined ? null : normalizeGlotoncitosEmail(updates.email)
  const roleCode = updates.roleCode === undefined
    ? null
    : normalizeRoleCode(updates.roleCode)
  if (roleCode === 'admin') throw forbidden('Cannot promote to admin')
  const active = updates.active === undefined ? null : updates.active
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const current = await client.query(
      'SELECT id_usuario, id_rol, correo FROM usuarios WHERE id_usuario = $1 AND id_restaurante = $2',
      [userId, restaurantId],
    )
    if (current.rowCount === 0) throw notFound('User not found')

    let roleId = current.rows[0].id_rol
    if (roleCode !== null) {
      const role = await getRoleByCode(client, roleCode)
      if (!role) throw notFound('Role not found')
      roleId = role.id_rol
    }

    if (email !== null) {
      const existing = await client.query(
        'SELECT id_usuario FROM usuarios WHERE correo = $1 AND id_usuario <> $2 AND id_restaurante = $3',
        [email, userId, restaurantId],
      )
      if (existing.rowCount > 0) throw conflict('Email is already registered')
    }

    const values = []
    const assignments = []
    if (name !== null) {
      values.push(name)
      assignments.push(`nombre = $${values.length}`)
    }
    if (email !== null) {
      values.push(email)
      assignments.push(`correo = $${values.length}`)
    }
    values.push(roleId)
    assignments.push(`id_rol = $${values.length}`)
    if (active !== null) {
      if (typeof active !== 'boolean') throw new TypeError('Active must be a boolean')
      values.push(active)
      assignments.push(`estado = $${values.length}`)
    }
    values.push(userId, restaurantId)
    const result = await client.query(
      `UPDATE usuarios
       SET ${assignments.join(', ')}, actualizado_en = now()
       WHERE id_usuario = $${values.length - 1}
         AND id_restaurante = $${values.length}
       RETURNING id_usuario, nombre, correo, estado, creado_en, actualizado_en,
                 id_restaurante, id_rol`,
      values,
    )

    await client.query('COMMIT')
    const row = await getUserRow(result.rows[0].id_usuario, restaurantId)
    return formatUser(row)
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof TypeError) throw error
    throw error
  } finally {
    client.release()
  }
}

export async function deactivateUser(userId, restaurantId) {
  return updateUser(userId, restaurantId, { active: false })
}

export async function getUser(userId, restaurantId) {
  const row = await getUserRow(userId, restaurantId)
  if (!row) throw notFound('User not found')
  return formatUser(row)
}
