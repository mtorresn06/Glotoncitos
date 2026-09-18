import { Router } from 'express'
import { createUser, listUsers } from '../services/user-service.js'
import { listRoles } from '../services/roles-service.js'
import { normalizeEmail, normalizeRoleCodes, validatePassword } from '../utils/validation.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.get('/roles', authenticateToken, requireAdmin, asyncRoute(async (_req, res) => {
  res.json({ roles: await listRoles() })
}))

router.get('/users', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  res.json({ users: await listUsers(req.auth.businessId) })
}))

router.post('/users', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const user = await createUser({
    email: normalizeEmail(req.body?.email),
    password: validatePassword(req.body?.password),
    roleCodes: normalizeRoleCodes(req.body?.roleCodes),
    businessId: req.auth.businessId,
    createdBy: req.auth.sub,
  })
  res.status(201).json(user)
}))

export default router
