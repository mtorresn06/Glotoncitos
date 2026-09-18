import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool, closePool } from './pool.js'

const accounts = [
  { emailVariable: 'SEED_ADMIN_EMAIL', passwordVariable: 'SEED_ADMIN_PASSWORD', roleCode: 'admin' },
  { emailVariable: 'SEED_MESERO_EMAIL', passwordVariable: 'SEED_MESERO_PASSWORD', roleCode: 'mesero' },
  { emailVariable: 'SEED_CAJERO_EMAIL', passwordVariable: 'SEED_CAJERO_PASSWORD', roleCode: 'cajero' },
  { emailVariable: 'SEED_COCINA_EMAIL', passwordVariable: 'SEED_COCINA_PASSWORD', roleCode: 'cocina' },
]

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

async function seed() {
  const businessSlug = required('SEED_BUSINESS_SLUG')
  const businessName = required('SEED_BUSINESS_NAME')
  const adminEmail = required('SEED_ADMIN_EMAIL')
  const adminPassword = required('SEED_ADMIN_PASSWORD')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const businessResult = await client.query(
      `INSERT INTO businesses (slug, name)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [businessSlug, businessName],
    )
    const businessId = businessResult.rows[0].id

    const rolesResult = await client.query(
      'SELECT id, code FROM roles ORDER BY code',
    )
    const rolesByCode = new Map(rolesResult.rows.map((role) => [role.code, role.id]))

    const adminHash = await bcrypt.hash(adminPassword, 12)
    const adminResult = await client.query(
      `INSERT INTO users (business_id, email, password_hash, created_by)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (email) DO UPDATE
         SET business_id = EXCLUDED.business_id,
             password_hash = EXCLUDED.password_hash,
             is_active = true,
             updated_at = now()
       RETURNING id`,
      [businessId, adminEmail, adminHash],
    )
    const adminId = adminResult.rows[0].id
    const adminRoleId = rolesByCode.get('admin')

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, business_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id, business_id) DO NOTHING`,
      [adminId, adminRoleId, businessId, adminId],
    )

    for (const account of accounts.slice(1)) {
      const email = required(account.emailVariable)
      const password = required(account.passwordVariable)
      const hash = await bcrypt.hash(password, 12)
      const role = rolesByCode.get(account.roleCode)
      const result = await client.query(
        `INSERT INTO users (business_id, email, password_hash, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
           SET business_id = EXCLUDED.business_id,
               password_hash = EXCLUDED.password_hash,
               is_active = true,
               updated_at = now()
         RETURNING id`,
        [businessId, email, hash, adminId],
      )
      const userId = result.rows[0].id

      await client.query(
        `INSERT INTO user_roles (user_id, role_id, business_id, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role_id, business_id) DO NOTHING`,
        [userId, role, businessId, adminId],
      )
    }

    await client.query('COMMIT')
    console.log('Seed completed')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

seed()
  .catch((error) => {
    console.error('Seed failed', error)
    process.exitCode = 1
  })
  .finally(closePool)
