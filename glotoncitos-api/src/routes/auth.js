import { Router } from 'express'
import { login } from '../services/auth-service.js'
import { normalizeGlotoncitosEmail, validatePassword } from '../utils/validation.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.post('/login', asyncRoute(async (req, res) => {
  const email = normalizeGlotoncitosEmail(req.body?.email)
  const password = validatePassword(req.body?.password)
  const session = await login({ email, password })
  res.json(session)
}))

export default router
