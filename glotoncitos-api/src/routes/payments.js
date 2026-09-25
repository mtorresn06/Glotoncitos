import { Router } from 'express'
import { createPayment, listPayments } from '../services/payment-service.js'
import { authenticateToken, requireRoles } from '../middleware/auth.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.post('/',
  authenticateToken,
  requireRoles('cajero', 'admin'),
  asyncRoute(async (req, res) => {
    const body = req.body || {}
    const orderId = body.orderId || body.id_pedido
    const method = body.method || body.metodo_pago
    const payment = await createPayment({
      orderId,
      method,
      userId: req.auth.userId,
      restaurantId: req.auth.restaurantId,
    })
    res.status(201).json(payment)
  }))

router.get('/',
  authenticateToken,
  requireRoles('cajero', 'admin'),
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const payments = await listPayments({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
      method: query.method || query.metodo_pago || null,
    })
    res.json({ payments })
  }))

export default router
