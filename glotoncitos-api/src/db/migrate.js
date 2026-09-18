import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { pool, closePool } from '../db/pool.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationsDirectory = path.resolve(currentDirectory, '../../migrations')

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort()

  for (const filename of files) {
    const applied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [filename],
    )

    if (applied.rowCount > 0) continue

    const sql = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename],
      )
      await client.query('COMMIT')
      console.log(`Applied migration ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

runMigrations()
  .catch((error) => {
    console.error('Migration failed', error)
    process.exitCode = 1
  })
  .finally(closePool)
