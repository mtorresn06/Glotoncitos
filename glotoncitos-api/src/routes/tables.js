import { Router } from 'express'
import {
  listTables,
  createTable,
  updateTable,
  getTable,
  deleteTable,
  updateTableStatus,
} from '../services/table-service.js'
import { authenticateToken, requireAdmin, requireMesero } from '../middleware/auth.js'

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

const router = Router()

router.get('/', authenticateToken, asyncRoute(async (req, res) => {
  res.json({ tables: await listTables(req.auth.restaurantId) })
}))

router.post('/', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const table = await createTable({
    restaurantId: req.auth.restaurantId,
    number: req.body?.number,
    capacity: req.body?.capacity,
    idPiso: req.body?.idPiso,
  })
  res.status(201).json({ table })
}))

router.get('/:id', authenticateToken, asyncRoute(async (req, res) => {
  const table = await getTable(req.params.id, req.auth.restaurantId)
  res.json({ table })
}))

router.put('/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const table = await updateTable(req.params.id, req.auth.restaurantId, {
    number: req.body?.number,
    capacity: req.body?.capacity,
    status: req.body?.status,
  })
  res.json({ table })
}))

router.patch('/:id/status', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const table = await updateTableStatus(
    req.params.id,
    req.auth.restaurantId,
    req.auth.userId,
    req.body?.status,
  )
  res.json({ table })
}))

router.delete('/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  await deleteTable(req.params.id, req.auth.restaurantId)
  res.status(204).end()
}))

export default router
