import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { getServerConfig } from '../config/env.js'
import { unauthorized } from '../utils/errors.js'
import { normalizeGlotoncitosEmail, normalizePassword } from '../utils/validation.js'

function formatRole(row) {
  return {
    id: row.id_rol,
    code: row.codigo,
    name: row.role_name,
    description: row.role_description,
  }
}

function formatUser(row) {
  const role = formatRole(row)

  return {
    id: row.id_usuario,
    name: row.nombre,
    email: row.correo,
    active: row.estado,
    role,
    roles: [role],
    restaurant: {
      id: row.id_restaurante,
      name: row.restaurant_name,
      nit: row.nit,
    },
  }
}

export async function login({ email, password }) {
  const normalizedEmail = normalizeGlotoncitosEmail(email)
  normalizePassword(password)

  // CORREGIDO: Se ajustaron los nombres para que coincidan con la tabla SQL
  const result = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.password_hash, u.estado,
            r.id_rol, r.codigo, r.nombre AS role_name, r.descripcion AS role_description,
            b.id_restaurante, b.nombre AS restaurant_name, b.nit, b.estado_suscripcion
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     JOIN restaurantes b ON b.id_restaurante = u.id_restaurante
     WHERE u.correo = $1`,
    [normalizedEmail],
  )

  if (result.rowCount === 0) throw unauthorized()

  const user = result.rows[0]
  const passwordMatches = await bcrypt.compare(password, user.password_hash)

  if (!user.estado || !passwordMatches) throw unauthorized()
  if (user.estado_suscripcion !== 'activa') {
    throw unauthorized('Restaurant subscription is inactive')
  }

  const config = getServerConfig()
  const accessToken = jwt.sign(
    {
      restaurantId: user.id_restaurante,
      role: user.codigo,
    },
    config.jwtSecret,
    {
      subject: user.id_usuario,
      expiresIn: config.jwtExpiresIn,
      issuer: 'glotoncitos-api',
      audience: 'glotoncitos-client',
    },
  )

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.jwtExpiresIn,
    user: formatUser(user),
  }
}

export async function getCurrentUser({ userId, restaurantId }) {
  const result = await pool.query(
    `SELECT u.id_usuario, u.nombre, u.correo, u.estado,
            r.id_rol, r.codigo, r.nombre AS role_name, r.descripcion AS role_description,
            b.id_restaurante, b.nombre AS restaurant_name, b.nit, b.estado_suscripcion
     FROM usuarios u
     JOIN roles r ON r.id_rol = u.id_rol
     JOIN restaurantes b ON b.id_restaurante = u.id_restaurante
     WHERE u.id_usuario = $1 AND u.id_restaurante = $2`,
    [userId, restaurantId],
  )

  if (result.rowCount === 0) throw unauthorized()

  const user = result.rows[0]
  if (!user.estado || user.estado_suscripcion !== 'activa') throw unauthorized()
  return formatUser(user)
}