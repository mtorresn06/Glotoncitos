import { Router } from 'express'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/menu-service.js'
import { authenticateToken, requireAdmin } from '../middleware/auth.js'
import { notFound } from '../utils/errors.js'
import { pool } from '../db/pool.js'
import { normalizeUuid } from '../utils/validation.js'

const router = Router()

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

router.get('/categories', authenticateToken, asyncRoute(async (_req, res) => {
  res.json({ categories: await listCategories() })
}))

router.get('/categories/:id', authenticateToken, asyncRoute(async (req, res) => {
  const id = normalizeUuid(req.params.id, 'Category id')
  const result = await pool.query(
    'SELECT id_categoria, nombre, creado_en, actualizado_en FROM categorias WHERE id_categoria = $1',
    [id],
  )
  if (result.rowCount === 0) throw notFound('Category not found')
  res.json({ category: { id: result.rows[0].id_categoria, name: result.rows[0].nombre, createdAt: result.rows[0].creado_en, updatedAt: result.rows[0].actualizado_en } })
}))

router.post('/categories', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const category = await createCategory({ name: req.body?.name })
  res.status(201).json({ category })
}))

router.put('/categories/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const category = await updateCategory(req.params.id, { name: req.body?.name })
  res.json({ category })
}))

router.delete('/categories/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  await deleteCategory(req.params.id)
  res.status(204).end()
}))

router.get('/products', authenticateToken, asyncRoute(async (req, res) => {
  const availableOnly = req.query.availableOnly === 'true'
  res.json({ products: await listProducts(req.auth.restaurantId, { availableOnly }) })
}))

router.post('/products', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const product = await createProduct({
    restaurantId: req.auth.restaurantId,
    categoryId: req.body?.categoryId,
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    type: req.body?.type,
    available: req.body?.available,
  })
  res.status(201).json({ product })
}))

router.put('/products/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  const product = await updateProduct(req.params.id, req.auth.restaurantId, {
    categoryId: req.body?.categoryId,
    name: req.body?.name,
    description: req.body?.description,
    price: req.body?.price,
    type: req.body?.type,
    available: req.body?.available,
  })
  res.json({ product })
}))

router.delete('/products/:id', authenticateToken, requireAdmin, asyncRoute(async (req, res) => {
  await deleteProduct(req.params.id, req.auth.restaurantId)
  res.status(204).end()
}))

export default router
