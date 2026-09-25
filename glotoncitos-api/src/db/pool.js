import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) throw new Error('DATABASE_URL is required')

  return {
    connectionString,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
    max: Number.parseInt(process.env.DB_POOL_SIZE || '10', 10),
  }
}

export const pool = new Pool(getDatabaseConfig())

export async function closePool() {
  await pool.end()
}
