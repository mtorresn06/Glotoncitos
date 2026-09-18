import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { getServerConfig } from '../config/env.js'
import { getRolesForUser } from './roles-service.js'
import { unauthorized } from '../utils/errors.js'
import { normalizeEmail, validatePassword } from '../utils/validation.js'

export async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email)
  validatePassword(password)

  const userResult = await pool.query(
    `SELECT u.id, u.email, u.is_active, u.password_hash,
            b.id AS business_id, b.name AS business_name
     FROM users u
     JOIN businesses b ON b.id = u.business_id
     WHERE u.email = $1`,
    [normalizedEmail],
  )

  if (userResult.rowCount === 0) throw unauthorized()

  const user = userResult.rows[0]
  const passwordMatches = await bcrypt.compare(password, user.password_hash)

  if (!user.is_active || !passwordMatches) throw unauthorized()

  const roles = await getRolesForUser(pool, user.id, user.business_id)
  const config = getServerConfig()
  const accessToken = jwt.sign(
    { businessId: user.business_id },
    config.jwtSecret,
    {
      subject: user.id,
      expiresIn: config.jwtExpiresIn,
      issuer: 'glotoncitos-api',
      audience: 'glotoncitos-client',
    },
  )

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.jwtExpiresIn,
    user: {
      id: user.id,
      email: user.email,
      business: {
        id: user.business_id,
        name: user.business_name,
      },
      roles,
    },
  }
}
