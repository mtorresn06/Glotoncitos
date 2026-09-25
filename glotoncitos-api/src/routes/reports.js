import { Router } from 'express'
import {
  getSalesByDate,
  getSalesByMonth,
  getSalesSummary,
  getTableTurnover,
  getTopProducts,
  getWorkerStats,
} from '../services/report-service.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.get('/sales-summary',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const summary = await getSalesSummary({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
    })
    res.json(summary)
  }))

router.get('/sales-by-date',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const data = await getSalesByDate({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
    })
    res.json({ salesByDate: data })
  }))

router.get('/top-products',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const limit = query.limit || query.limite || 10
    const data = await getTopProducts({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
      limit: Number(limit),
    })
    res.json({ topProducts: data })
  }))

router.get('/table-turnover',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const data = await getTableTurnover({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
    })
    res.json({ tableTurnover: data })
  }))

router.get('/sales-by-month',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const data = await getSalesByMonth({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
    })
    res.json({ salesByMonth: data })
  }))

router.get('/worker-stats',
  authenticateToken,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const query = req.query || {}
    const data = await getWorkerStats({
      restaurantId: req.auth.restaurantId,
      dateFrom: query.dateFrom || query.fecha_desde || null,
      dateTo: query.dateTo || query.fecha_hasta || null,
    })
    res.json({ workerStats: data })
  }))

export default router
