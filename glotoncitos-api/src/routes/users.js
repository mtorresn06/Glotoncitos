import { Router } from 'express'
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
} from '../services/user-service.js'
import { listRoles } from '../services/roles-service.js'
import { normalizeGlotoncitosEmail, normalizeRoleCode, validatePassword, normalizeName, normalizeBoolean } from '../utils/validation.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { forbidden, notFound } from '../utils/errors.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.get('/roles', authenticateToken, requireAdmin, asyncRoute(async (_req, res) => {
  res.json({ roles: await listRoles() })
}))

router.get('/users', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  res.json({ users: await listUsers(req.auth.restaurantId) })
}))

router.get('/users/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const user = await getUser(req.params.id, req.auth.restaurantId)
  res.json(user)
}))

router.post('/users', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const roleCode = normalizeRoleCode(req.body?.roleCode)
  if (roleCode === 'admin') throw forbidden('Cannot create admin users')
  const user = await createUser({
    name: normalizeName(req.body?.name, 'Name'),
    email: normalizeGlotoncitosEmail(req.body?.email),
    password: validatePassword(req.body?.password),
    roleCode,
    restaurantId: req.auth.restaurantId,
    createdBy: req.auth.userId,
  })
  res.status(201).json(user)
}))

router.patch('/users/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const targetId = req.params.id
  if (targetId === req.auth.userId) throw forbidden('Cannot modify your own account')

  const updates = {}
  if (req.body.name !== undefined) updates.name = normalizeName(req.body.name, 'Name')
  if (req.body.email !== undefined) updates.email = normalizeGlotoncitosEmail(req.body.email)
  if (req.body.roleCode !== undefined) {
    const roleCode = normalizeRoleCode(req.body.roleCode)
    if (roleCode === 'admin') throw forbidden('Cannot promote to admin')
    updates.roleCode = roleCode
  }
  if (req.body.active !== undefined) updates.active = normalizeBoolean(req.body.active, 'Active')

  const user = await updateUser(targetId, req.auth.restaurantId, updates)
  res.json(user)
}))

router.delete('/users/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const targetId = req.params.id
  if (targetId === req.auth.userId) throw forbidden('Cannot delete your own account')

  const target = await getUser(targetId, req.auth.restaurantId)
  if (target.role?.code === 'admin') throw forbidden('Cannot delete admin users')

  await deactivateUser(targetId, req.auth.restaurantId)
  res.status(204).send()
}))

export default router