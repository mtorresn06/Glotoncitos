import { Router } from 'express'
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderItem,
  updateOrderItemStatus,
} from '../services/order-service.js'
import { authenticateToken, requireRoles, requireMesero, requireCocina } from '../middleware/auth.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.get('/', authenticateToken, requireRoles('mesero', 'cajero', 'admin'), asyncRoute(async (req, res) => {
  res.json({ orders: await listOrders(req.auth.restaurantId, req.auth.roleCode, req.auth.userId) })
}))

router.post('/', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const order = await createOrder({
    restaurantId: req.auth.restaurantId,
    userId: req.auth.userId,
    mesaId: req.body?.mesaId,
    items: req.body?.items,
  })
  res.status(201).json({ order })
}))

router.get('/:id', authenticateToken, requireRoles('mesero', 'cajero', 'admin'), asyncRoute(async (req, res) => {
  const order = await getOrder(req.params.id, req.auth.restaurantId, req.auth.roleCode, req.auth.userId)
  res.json({ order })
}))

router.put('/:orderId/items/:itemId', authenticateToken, requireMesero, asyncRoute(async (req, res) => {
  const result = await updateOrderItem({
    orderId: req.params.orderId,
    itemId: req.params.itemId,
    restaurantId: req.auth.restaurantId,
    quantity: req.body?.quantity,
    notes: req.body?.notes,
    cancel: req.body?.cancel,
  })
  res.json({ order: result })
}))

router.patch('/:orderId/items/:itemId/status', authenticateToken, requireCocina, asyncRoute(async (req, res) => {
  const result = await updateOrderItemStatus({
    orderId: req.params.orderId,
    itemId: req.params.itemId,
    restaurantId: req.auth.restaurantId,
    status: req.body?.status,
  })
  res.json({ order: result })
}))

export default router
