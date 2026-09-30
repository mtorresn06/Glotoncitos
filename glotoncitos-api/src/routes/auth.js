import { Router } from 'express'
import { login } from '../services/auth-service.js'
import { normalizeGlotoncitosEmail } from '../utils/validation.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.post('/login', asyncRoute(async (req, res) => {
  const email = normalizeGlotoncitosEmail(req.body?.email)
  // la longitud de la contrasena se valida dentro de login, luego de comparar el hash
  const session = await login({ email, password: req.body?.password }, { ip: req.ip })
  res.json(session)
}))

export default router
