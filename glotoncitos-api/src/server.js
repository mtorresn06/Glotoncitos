import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool, closePool } from './db/pool.js'
import { getServerConfig } from './config/env.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import menuRoutes from './routes/menu.js'
import tableRoutes from './routes/tables.js'
import orderRoutes from './routes/orders.js'
import paymentRoutes from './routes/payments.js'
import reportRoutes from './routes/reports.js'
import frontendRoutes from './routes/frontend.js'
import { HttpError } from './utils/errors.js'

export const app = express()
const config = getServerConfig()

app.disable('x-powered-by')
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '16kb' }))
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
  next()
})

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch (error) {
    next(error)
  }
})

app.use('/api/auth', authRoutes)
app.use('/api', userRoutes)
app.use('/api', frontendRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports', reportRoutes)

app.use((_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'))
})

app.use((error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    })
  }

  if (error?.code === '23505') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'Resource already exists' },
    })
  }

  console.error(error)
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
  })
})

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (currentFile === invokedFile) {
  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`)
  })
}

export { closePool }
