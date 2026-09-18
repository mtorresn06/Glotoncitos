import jwt from 'jsonwebtoken'
import { getServerConfig } from '../config/env.js'
import { forbidden, unauthorized } from '../utils/errors.js'
import { getRolesForUser } from '../services/roles-service.js'
import { pool } from '../db/pool.js'

export function authenticateToken(req, _res, next) {
  const header = req.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return next(unauthorized('Authentication is required'))

  try {
    const config = getServerConfig()
    req.auth = jwt.verify(token, config.jwtSecret, {
      issuer: 'glotoncitos-api',
      audience: 'glotoncitos-client',
    })
    next()
  } catch {
    next(unauthorized('Token is invalid or expired'))
  }
}

export async function requireAdmin(req, _res, next) {
  try {
    const roles = await getRolesForUser(
      pool,
      req.auth.sub,
      req.auth.businessId,
    )
    if (!roles.some((role) => role.code === 'admin')) {
      throw forbidden()
    }
    next()
  } catch (error) {
    next(error)
  }
}
