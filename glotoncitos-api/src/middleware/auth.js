import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { getServerConfig } from '../config/env.js'
import { forbidden, unauthorized } from '../utils/errors.js'

function requireClaim(value, name) {
  if (typeof value !== 'string' || !value) {
    throw unauthorized(`Token is missing ${name}`)
  }
}

export async function authenticateToken(req, _res, next) {
  const header = req.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return next(unauthorized('Authentication is required'))

  try {
    const config = getServerConfig()
    const payload = jwt.verify(token, config.jwtSecret, {
      issuer: 'glotoncitos-api',
      audience: 'glotoncitos-client',
    })

    requireClaim(payload.sub, 'subject')
    requireClaim(payload.restaurantId, 'restaurantId')
    requireClaim(payload.role, 'role')

    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.estado,
              r.codigo AS role_code, r.nombre AS role_name,
              b.id_restaurante, b.nombre AS restaurant_name, b.estado_suscripcion
       FROM usuarios u
       JOIN roles r ON r.id_rol = u.id_rol
       JOIN restaurantes b ON b.id_restaurante = u.id_restaurante
       WHERE u.id_usuario = $1 AND u.id_restaurante = $2`,
      [payload.sub, payload.restaurantId],
    )

    if (result.rowCount === 0) throw unauthorized('User not found')

    const user = result.rows[0]
    if (!user.estado || user.estado_suscripcion !== 'activa') {
      throw unauthorized('User or restaurant is inactive')
    }
    if (user.role_code !== payload.role) throw unauthorized('Token role is invalid')

    req.auth = {
      userId: user.id_usuario,
      restaurantId: user.id_restaurante,
      roleCode: user.role_code,
      roleName: user.role_name,
      userName: user.nombre,
      userEmail: user.correo,
      restaurantName: user.restaurant_name,
    }
    next()
  } catch (error) {
    next(error instanceof Error && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
      ? unauthorized('Token is invalid or expired')
      : error)
  }
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.roleCode)) {
      return next(forbidden())
    }
    next()
  }
}

export const requireAdmin = requireRoles('admin')
export const requireMesero = requireRoles('mesero')
export const requireCajero = requireRoles('cajero')
export const requireCocina = requireRoles('cocina')
