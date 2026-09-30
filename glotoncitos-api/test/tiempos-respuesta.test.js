import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { listTables } from '../src/services/table-service.js'
import { listarPisos } from '../src/services/piso-service.js'
import { listOrders } from '../src/services/order-service.js'
import { listUsers } from '../src/services/user-service.js'
import { listPayments } from '../src/services/payment-service.js'
import { listCategories, listProducts } from '../src/services/menu-service.js'
import { closePool } from '../src/db/pool.js'

const databaseUrl = process.env.DATABASE_URL
const restaurantId = process.env.PRESTAURANTE_ID
const puedeMedir = Boolean(databaseUrl && restaurantId)

const PRESUPUESTO_MS = 300

let mediciones = []
let adminUserId = null

async function medir(nombre, operacion) {
  const inicio = performance.now()
  const resultado = await operacion()
  const total = Number((performance.now() - inicio).toFixed(1))
  mediciones.push({ nombre, ms: total })
  return resultado
}

if (puedeMedir) {
  before(async () => {
    const { pool } = await import('../src/db/pool.js')
    const consulta = await pool.query('SELECT 1')
    assert.equal(consulta.rowCount, 1)

    const admin = await pool.query(
      `SELECT u.id_usuario
       FROM usuarios u
       JOIN roles r ON r.id_rol = u.id_rol
       WHERE u.id_restaurante = $1 AND r.codigo = 'admin'
       LIMIT 1`,
      [restaurantId],
    )
    adminUserId = admin.rows[0]?.id_usuario || null
  })

  after(async () => {
    if (mediciones.length) {
      console.log('\nTiempos reales de respuesta a la base de datos (Postgres)')
      for (const item of mediciones) console.log(`  ${item.nombre}: ${item.ms} ms`)
    }
    await closePool()
  })
}

test('responde con la configuracion necesaria para medir', { skip: !puedeMedir }, async () => {
  assert.ok(databaseUrl)
  assert.ok(restaurantId)
})

test('listar mesas responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  const mesas = await medir('GET /api/mesas', () => listTables(restaurantId))
  assert.ok(Array.isArray(mesas))
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})

test('listar pisos responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  const pisos = await medir('GET /api/pisos', () => listarPisos(restaurantId))
  assert.ok(Array.isArray(pisos))
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})

test('listar pedidos del administrador responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  assert.ok(adminUserId, 'no hay usuario administrador en la base de prueba')
  const pedidos = await medir(
    'GET /api/pedidos (admin)',
    () => listOrders(restaurantId, 'admin', adminUserId),
  )
  assert.ok(Array.isArray(pedidos))
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})

test('listar trabajadores responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  const trabajadores = await medir('GET /api/trabajadores', () => listUsers(restaurantId))
  assert.ok(Array.isArray(trabajadores))
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})

test('listar pagos del dia responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  const pagos = await medir('GET /api/pagos', () => listPayments({ restaurantId }))
  assert.ok(pagos)
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})

test('cargar el menu responde dentro del presupuesto', { skip: !puedeMedir }, async () => {
  const categorias = await medir('GET /api/categorias', () => listCategories())
  const productos = await medir('GET /api/productos', () => listProducts(restaurantId))
  assert.ok(Array.isArray(categorias))
  assert.ok(Array.isArray(productos))
  assert.ok(mediciones.at(-1).ms < PRESUPUESTO_MS)
})
