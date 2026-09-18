import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import request from 'supertest'
import {
  normalizeEmail,
  normalizeRoleCodes,
  validatePassword,
} from '../src/utils/validation.js'

const databaseUrl = process.env.DATABASE_URL
const adminEmail = process.env.SEED_ADMIN_EMAIL
const adminPassword = process.env.SEED_ADMIN_PASSWORD
const canRunIntegration = Boolean(databaseUrl && adminEmail && adminPassword)

let app
let closePool

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
  assert.throws(() => normalizeEmail('invalid'), /valid email/)
  assert.throws(() => normalizeRoleCodes([]), /At least one role/)
  assert.throws(() => validatePassword('short'), /between 12 and 128/)
})

test('login and admin user management flow', { skip: !canRunIntegration }, async () => {
  const createdEmail = `integration-${randomUUID()}@example.com`
  const createdPassword = 'integration-password-123'

  const health = await request(app).get('/health')
  assert.equal(health.status, 200)

  const unauthorized = await request(app).get('/api/users')
  assert.equal(unauthorized.status, 401)

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: adminEmail, password: adminPassword })
  assert.equal(login.status, 200)
  assert.equal(login.body.user.roles[0].code, 'admin')

  const token = login.body.access_token
  const roles = await request(app)
    .get('/api/roles')
    .set('Authorization', `Bearer ${token}`)
  assert.equal(roles.status, 200)
  assert.ok(roles.body.roles.some((role) => role.code === 'mesero'))

  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: createdEmail,
      password: createdPassword,
      roleCodes: ['mesero'],
    })
  assert.equal(created.status, 201)
  assert.equal(created.body.email, createdEmail)
  assert.equal(created.body.roles[0].code, 'mesero')

  const duplicate = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: createdEmail,
      password: createdPassword,
      roleCodes: ['mesero'],
    })
  assert.equal(duplicate.status, 409)

  const invalidRole = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: `invalid-${randomUUID()}@example.com`,
      password: createdPassword,
      roleCodes: ['unknown'],
    })
  assert.equal(invalidRole.status, 400)

  const waiterLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: createdEmail, password: createdPassword })
  assert.equal(waiterLogin.status, 200)
  assert.equal(waiterLogin.body.user.roles[0].code, 'mesero')
})
