import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { getServerConfig } from '../config/env.js'
import { tooManyRequests, unauthorized } from '../utils/errors.js'
import { normalizeGlotoncitosEmail, normalizePassword } from '../utils/validation.js'

const MAX_INTENTOS_FALLIDOS = 3
const MINUTOS_DE_BLOQUEO = 5
const MS_POR_MINUTO = 60 * 1000

const intentosPorCorreo = new Map()
const intentosPorIp = new Map()

function bloqueoActivo(registros, clave) {
  if (!clave) return null
  const registro = registros.get(clave)
  if (!registro) return null
  const ahora = Date.now()
  if (registro.bloqueadoHasta > ahora) return registro
  if (registro.bloqueadoHasta > 0) registros.delete(clave)
  return null
}

function registrarIntentoFallido(correo, ip) {
  const ahora = Date.now()
  for (const [registros, clave] of [
    [intentosPorCorreo, correo],
    [intentosPorIp, ip],
  ]) {
    if (!clave) continue
    const previo = registros.get(clave)
    const vigente = previo && (previo.bloqueadoHasta === 0 || previo.bloqueadoHasta > ahora)
    const registro = vigente ? previo : { fallos: 0, bloqueadoHasta: 0 }
    registro.fallos += 1
    if (registro.fallos >= MAX_INTENTOS_FALLIDOS) {
      registro.bloqueadoHasta = ahora + MINUTOS_DE_BLOQUEO * MS_POR_MINUTO
    }
    registros.set(clave, registro)
  }
}

function limpiarIntentos(correo, ip) {
  intentosPorCorreo.delete(correo)
  if (ip) intentosPorIp.delete(ip)
}

function minutosRestantes(registro) {
  return Math.max(1, Math.ceil((registro.bloqueadoHasta - Date.now()) / MS_POR_MINUTO))
}

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

export async function login({ email, password }, { ip } = {}) {
  const normalizedEmail = normalizeGlotoncitosEmail(email)

  const bloqueo = bloqueoActivo(intentosPorCorreo, normalizedEmail)
    || bloqueoActivo(intentosPorIp, ip)
  if (bloqueo) {
    const minutos = minutosRestantes(bloqueo)
    throw tooManyRequests(
      `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
      { retryAfterMinutes: minutos },
    )
  }

  const fallo = () => {
    registrarIntentoFallido(normalizedEmail, ip)
    return unauthorized()
  }

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

  if (result.rowCount === 0) throw fallo()

  const user = result.rows[0]
  const passwordMatches =
    typeof password === 'string' && (await bcrypt.compare(password, user.password_hash))

  if (!user.estado || !passwordMatches) throw fallo()

  // la longitud se valida recien cuando las credenciales ya son correctas
  normalizePassword(password)

  if (user.estado_suscripcion !== 'activa') {
    throw unauthorized('Restaurant subscription is inactive')
  }

  limpiarIntentos(normalizedEmail, ip)

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