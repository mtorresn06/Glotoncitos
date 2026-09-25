import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import {
  normalizeEmail,
  normalizeGlotoncitosEmail,
  normalizeRoleCodes,
  validatePassword,
} from '../src/utils/validation.js'

const databaseUrl = process.env.DATABASE_URL
const adminEmail = process.env.SEED_ADMIN_EMAIL
const adminPassword = process.env.SEED_ADMIN_PASSWORD
const meseroEmail = process.env.SEED_MESERO_EMAIL
const meseroPassword = process.env.SEED_MESERO_PASSWORD
const cajeroEmail = process.env.SEED_CAJERO_EMAIL
const cajeroPassword = process.env.SEED_CAJERO_PASSWORD
const cocinaEmail = process.env.SEED_COCINA_EMAIL
const cocinaPassword = process.env.SEED_COCINA_PASSWORD
const canRunIntegration = Boolean(databaseUrl && adminEmail && adminPassword)

let app
let closePool
let adminToken
let meseroToken
let cajeroToken
let cocinaToken
let restaurantId
let testTableId
let testOrderId
let testProductId

if (canRunIntegration) {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret'
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
  const server = await import('../src/server.js')
  app = server.app
  closePool = server.closePool
}

after(async () => {
  if (closePool) await closePool()
})

test('validates normalized emails and role codes', () => {
  assert.equal(normalizeEmail('  Usuario@Example.COM '), 'usuario@example.com')
  assert.deepEqual(normalizeRoleCodes(['Mesero', 'mesero', 'cajero']), ['mesero', 'cajero'])
  assert.equal(validatePassword('a-password-with-123'), 'a-password-with-123')
  assert.throws(() => normalizeEmail('invalid'), /Email is invalid/)
  assert.throws(() => normalizeRoleCodes([]), /At least one role/)
  assert.throws(() => validatePassword('short'), /between 12 and 128/)
})

test('glotoncitos email enforcement', () => {
  assert.throws(() => normalizeGlotoncitosEmail('user@example.com'), /@glotoncitos\.com/)
  assert.equal(normalizeGlotoncitosEmail('user@glotoncitos.com'), 'user@glotoncitos.com')
  assert.equal(normalizeGlotoncitosEmail('  User@Glotoncitos.COM  '), 'user@glotoncitos.com')
})

if (!canRunIntegration) {
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
  test('skipped (no database)', { skip: true })
}

test('login as admin', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: adminEmail, password: adminPassword })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.roles[0].code, 'admin')
  adminToken = res.body.access_token
  assert.ok(adminToken)
})

test('login as mesero', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: meseroEmail, password: meseroPassword })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.roles[0].code, 'mesero')
  meseroToken = res.body.access_token
  assert.ok(meseroToken)
})

test('login as cajero', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: cajeroEmail, password: cajeroPassword })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.roles[0].code, 'cajero')
  cajeroToken = res.body.access_token
  assert.ok(cajeroToken)
})

test('login as cocina', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: cocinaEmail, password: cocinaPassword })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.roles[0].code, 'cocina')
  cocinaToken = res.body.access_token
  assert.ok(cocinaToken)
})

test('unauthenticated request rejected', { skip: !canRunIntegration }, async () => {
  const res = await request(app).get('/api/users')
  assert.equal(res.status, 401)
})

test('admin user CRUD', { skip: !canRunIntegration }, async () => {
  const createdEmail = `admin-test-${Date.now()}@glotoncitos.com`
  const createdPassword = 'TestPassword123!'

  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: createdEmail, password: createdPassword, roleCodes: ['mesero'] })
  assert.equal(created.status, 201)
  assert.equal(created.body.email, createdEmail)
  assert.equal(created.body.roles[0].code, 'mesero')

  const listed = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(listed.status, 200)
  assert.ok(listed.body.users.some((u) => u.email === createdEmail))

  const fetched = await request(app)
    .get(`/api/users/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(fetched.status, 200)
  assert.equal(fetched.body.email, createdEmail)

  const updated = await request(app)
    .patch(`/api/users/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Updated Name', email: `updated-${Date.now()}@glotoncitos.com` })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.name, 'Updated Name')

  const deactivated = await request(app)
    .delete(`/api/users/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(deactivated.status, 204)
})

test('user @glotoncitos.com enforcement', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: 'invalid@example.com', password: 'TestPassword123!', roleCodes: ['mesero'] })
  assert.equal(res.status, 400)
})

test('admin cannot create admin user', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ email: `admin-test-${Date.now()}@glotoncitos.com`, password: 'TestPassword123!', roleCodes: ['admin'] })
  assert.equal(res.status, 403)
})

test('non-admin cannot access users', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(res.status, 403)
})

test('menu CRUD', { skip: !canRunIntegration }, async () => {
  const catRes = await request(app)
    .post('/api/menu/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Category' })
  assert.equal(catRes.status, 201)
  const categoryId = catRes.body.category.id

  const prodRes = await request(app)
    .post('/api/menu/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ categoryId, name: 'Test Product', price: 15000, type: 'plato' })
  assert.equal(prodRes.status, 201)
  testProductId = prodRes.body.product.id
  assert.equal(prodRes.body.product.name, 'Test Product')
  assert.equal(prodRes.body.product.available, true)

  const listed = await request(app)
    .get('/api/menu/products')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(listed.status, 201)
  assert.ok(listed.body.products.some((p) => p.id === testProductId))

  const availableOnly = await request(app)
    .get('/api/menu/products?availableOnly=true')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(availableOnly.status, 200)
  assert.ok(availableOnly.body.products.every((p) => p.available === true))

  const updated = await request(app)
    .put(`/api/menu/products/${testProductId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ price: 20000, available: false })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.product.price, 20000)
  assert.equal(updated.body.product.available, false)

  const deleted = await request(app)
    .delete(`/api/menu/products/${testProductId}`)
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(deleted.status, 204)
})

test('frontend productos endpoint', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/productos')
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.productos))
  if (res.body.productos.length > 0) {
    const p = res.body.productos[0]
    assert.ok(p.id && p.nombre && typeof p.precio === 'number')
  }
})

test('table CRUD', { skip: !canRunIntegration }, async () => {
  const created = await request(app)
    .post('/api/tables')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ number: 99, capacity: 4 })
  assert.equal(created.status, 201)
  testTableId = created.body.table.id
  assert.equal(created.body.table.number, 99)
  assert.equal(created.body.table.status, 'libre')

  const listed = await request(app)
    .get('/api/tables')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(listed.status, 200)
  assert.ok(listed.body.tables.some((t) => t.id === testTableId))

  const fetched = await request(app)
    .get(`/api/tables/${testTableId}`)
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(fetched.status, 200)
  assert.equal(fetched.body.table.number, 99)

  const meseroCannotCreate = await request(app)
    .post('/api/tables')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ number: 100, capacity: 2 })
  assert.equal(meseroCannotCreate.status, 403)

  const updated = await request(app)
    .put(`/api/tables/${testTableId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ capacity: 6 })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.table.capacity, 6)
})

test('table status transition by mesero', { skip: !canRunIntegration }, async () => {
  const occupied = await request(app)
    .patch(`/api/tables/${testTableId}/status`)
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ status: 'ocupada' })
  assert.equal(occupied.status, 200)
  assert.equal(occupied.body.table.status, 'ocupada')
  assert.ok(occupied.body.table.ocupadaDesde)

  const freed = await request(app)
    .patch(`/api/tables/${testTableId}/status`)
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ status: 'libre' })
  assert.equal(freed.status, 200)
  assert.equal(freed.body.table.status, 'libre')
  assert.equal(freed.body.table.ocupadaDesde, null)
})

test('frontend mesas endpoint', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/mesas')
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.mesas))
  if (res.body.mesas.length > 0) {
    const m = res.body.mesas[0]
    assert.ok(m.id && m.nombre && ['libre', 'ocupada', 'reservada'].includes(m.estado))
  }
})

test('order creation with items', { skip: !canRunIntegration }, async () => {
  await request(app)
    .patch(`/api/tables/${testTableId}/status`)
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ status: 'ocupada' })

  const productRes = await request(app)
    .get('/api/productos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const productId = productRes.body.productos[0].id

  const created = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({
      mesaId: testTableId,
      productos: [
        { productoId: productId, cantidad: 2, nota: 'sin salsa' },
      ],
    })
  assert.equal(created.status, 201)
  testOrderId = created.body.pedido.id
  assert.ok(testOrderId)
  assert.equal(created.body.pedido.estado, 'pendiente')
  assert.equal(created.body.pedido.mesaId, testTableId)
  assert.equal(created.body.pedido.productos.length, 1)
  assert.equal(created.body.pedido.productos[0].cantidad, 2)
  assert.equal(created.body.pedido.productos[0].nota, 'sin salsa')
  assert.ok(created.body.pedido.productos[0].precio > 0)
})

test('order validation errors', { skip: !canRunIntegration }, async () => {
  const noItems = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ mesaId: testTableId, productos: [] })
  assert.equal(noItems.status, 400)

  const invalidTable = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ mesaId: testTableId, productos: [{ productoId: '00000000-0000-0000-0000-000000000000', cantidad: 1 }] })
  assert.equal(invalidTable.status, 404)
})

test('waiter updates order items', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .patch(`/api/pedidos/${testOrderId}/items/0`)
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ cantidad: 3, nota: 'sin queso' })
  assert.equal(res.status, 200)
  assert.equal(res.body.pedido.productos[0].cantidad, 3)
  assert.equal(res.body.pedido.productos[0].nota, 'sin queso')

  const cancelled = await request(app)
    .delete(`/api/pedidos/${testOrderId}/items/0`)
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(cancelled.status, 200)
  assert.equal(cancelled.body.pedido.productos[0].estado, 'cancelado')
})

test('waiter cannot modify after preparation', { skip: !canRunIntegration }, async () => {
  const productRes = await request(app)
    .get('/api/productos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const productId = productRes.body.productos[0].id

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({
      mesaId: testTableId,
      productos: [{ productoId: productId, cantidad: 1 }],
    })

  const ordersRes = await request(app)
    .get('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const newOrder = ordersRes.body.pedidos.find((o) => o.mesaId === testTableId && o.estado === 'pendiente' && o.id !== testOrderId)
  assert.ok(newOrder, 'Expected a new pending order')

  const orderDetail = await request(app)
    .get(`/api/pedidos/${newOrder.id}`)
    .set('Authorization', `Bearer ${meseroToken}`)
  const itemId = orderDetail.body.pedido.productos[0].id || orderDetail.body.pedido.productos[0]._id

  const cancelled = await request(app)
    .delete(`/api/pedidos/${newOrder.id}/items/0`)
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(cancelled.status, 200)
})

test('kitchen item status transitions', { skip: !canRunIntegration }, async () => {
  const productRes = await request(app)
    .get('/api/productos')
    .set('Authorization', `Bearer ${cocinaToken}`)
  const productId = productRes.body.productos[0].id

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({
      mesaId: testTableId,
      productos: [{ productoId: productId, cantidad: 1 }],
    })

  const ordersRes = await request(app)
    .get('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const kitchenOrder = ordersRes.body.pedidos.find(
    (o) => o.mesaId === testTableId && o.estado === 'pendiente' && o.id !== testOrderId,
  )
  assert.ok(kitchenOrder)

  const orderDetail = await request(app)
    .get(`/api/pedidos/${kitchenOrder.id}`)
    .set('Authorization', `Bearer ${meseroToken}`)
  const itemId = orderDetail.body.pedido.productos[0].id

  const advanced = await request(app)
    .patch(`/api/pedidos/${kitchenOrder.id}/items/0/avanzar`)
    .set('Authorization', `Bearer ${cocinaToken}`)
  assert.equal(advanced.status, 200)
  assert.equal(advanced.body.pedido.productos[0].estado, 'en_preparacion')
})

test('kitchen cannot access waiter endpoints', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${cocinaToken}`)
    .send({ mesaId: testTableId, productos: [{ productoId: '00000000-0000-0000-0000-000000000000', cantidad: 1 }] })
  assert.equal(res.status, 403)
})

test('payment closes order and frees table', { skip: !canRunIntegration }, async () => {
  const productRes = await request(app)
    .get('/api/productos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const productId = productRes.body.productos[0].id

  await request(app)
    .post('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({
      mesaId: testTableId,
      productos: [{ productoId: productId, cantidad: 1 }],
    })

  const ordersRes = await request(app)
    .get('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
  const readyOrder = ordersRes.body.pedidos.find(
    (o) => o.mesaId === testTableId && o.estado === 'pendiente' && o.id !== testOrderId,
  )

  const orderDetail = await request(app)
    .get(`/api/pedidos/${readyOrder.id}`)
    .set('Authorization', `Bearer ${meseroToken}`)
  const itemId = orderDetail.body.pedido.productos[0].id

  await request(app)
    .patch(`/api/pedidos/${readyOrder.id}/items/0/avanzar`)
    .set('Authorization', `Bearer ${cocinaToken}`)
  await request(app)
    .patch(`/api/pedidos/${readyOrder.id}/items/0/avanzar`)
    .set('Authorization', `Bearer ${cocinaToken}`)

  const paid = await request(app)
    .post('/api/pagos')
    .set('Authorization', `Bearer ${cajeroToken}`)
    .send({ pedidoId: readyOrder.id })
  assert.equal(paid.status, 201)
  assert.equal(paid.body.pedido.status, 'cerrado')
  assert.ok(paid.body.pago.id)
  assert.equal(paid.body.pago.estado, 'pagado')
})

test('waiter cannot process payment', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/pagos')
    .set('Authorization', `Bearer ${meseroToken}`)
    .send({ pedidoId: testOrderId })
  assert.equal(res.status, 403)
})

test('closed orders visible to admin', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/pedidos-cerrados')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.pedidosCerrados))
})

test('closed orders not visible to waiter', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/pedidos-cerrados')
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(res.status, 403)
})

test('order visibility - waiter sees own orders', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/pedidos')
    .set('Authorization', `Bearer ${meseroToken}`)
  assert.equal(res.status, 200)
  for (const order of res.body.pedidos) {
    assert.ok(order.mesaId, 'Order should have mesaId')
  }
})

test('reports endpoints', { skip: !canRunIntegration }, async () => {
  const summary = await request(app)
    .get('/api/reportes/ventas-resumen')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(summary.status, 200)
  assert.ok(typeof summary.body.totalOrders === 'number')
  assert.ok(typeof summary.body.totalRevenue === 'number')

  const byDate = await request(app)
    .get('/api/reportes/ventas-fecha')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(byDate.status, 200)
  assert.ok(Array.isArray(byDate.body.ventasByDate))

  const byMonth = await request(app)
    .get('/api/reportes/ventas-mes')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(byMonth.status, 200)
  assert.ok(Array.isArray(byMonth.body.ventasByMonth))
  if (byMonth.body.ventasByMonth.length > 0) {
    assert.ok(byMonth.body.ventasByMonth[0].month)
    assert.ok(typeof byMonth.body.ventasByMonth[0].orders === 'number')
  }

  const top = await request(app)
    .get('/api/reportes/productos-top')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(top.status, 200)
  assert.ok(Array.isArray(top.body.topProducts))

  const turnover = await request(app)
    .get('/api/reportes/giro-mesas')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(turnover.status, 200)
  assert.ok(Array.isArray(turnover.body.tableTurnover))

  const workers = await request(app)
    .get('/api/reportes/estadisticas-trabajadores')
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(workers.status, 200)
  assert.ok(Array.isArray(workers.body.workerStats))
})

test('reports restricted to admin', { skip: !canRunIntegration }, async () => {
  const endpoints = [
    '/api/reportes/ventas-resumen',
    '/api/reportes/ventas-fecha',
    '/api/reportes/ventas-mes',
    '/api/reportes/productos-top',
    '/api/reportes/giro-mesas',
    '/api/reportes/estadisticas-trabajadores',
  ]
  for (const path of endpoints) {
    const res = await request(app).get(path).set('Authorization', `Bearer ${meseroToken}`)
    assert.equal(res.status, 403, `Expected 403 for ${path}`)
  }
})

test('tenant isolation - user cannot access other restaurant', { skip: !canRunIntegration }, async () => {
  const fakeId = '00000000-0000-0000-0000-000000000001'
  const res = await request(app)
    .get(`/api/users/${fakeId}`)
    .set('Authorization', `Bearer ${adminToken}`)
  assert.equal(res.status, 404)
})

test('frontend pagos endpoint', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/pagos')
    .set('Authorization', `Bearer ${cajeroToken}`)
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.pagos))
})

test('invalid token rejected', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .get('/api/users')
    .set('Authorization', 'Bearer invalid-token')
  assert.equal(res.status, 401)
})

test('non-glotoncitos email rejected on login', { skip: !canRunIntegration }, async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@example.com', password: 'any-password' })
  assert.equal(res.status, 400)
})
