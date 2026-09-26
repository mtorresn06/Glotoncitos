import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool, closePool } from './pool.js'

const BASE_CATEGORIES = [
  { nombre: 'Platos principales', descripcion: 'Platos fuertes y especialidades de la casa' },
  { nombre: 'Bebidas', descripcion: 'Bebidas frías, calientes y alcohólicas' },
  { nombre: 'Postres', descripcion: 'Postres caseros y helados' },
  { nombre: 'Adicionales', descripcion: 'Guarniciones, salsas y extras' },
  { nombre: 'Otros', descripcion: 'Productos varios' },
]

const BASE_PRODUCTS = [
  { nombre: 'Hamburguesa clásica', descripcion: 'Carne, lechuga, tomate, queso y papas fritas', precio: 25000, tipo: 'plato', categoria: 'Platos principales' },
  { nombre: 'Pizza margarita', descripcion: 'Masa artesanal, tomate, mozzarella, albahaca', precio: 32000, tipo: 'plato', categoria: 'Platos principales' },
  { nombre: 'Ensalada césar', descripcion: 'Lechuga, pollo, crutones, parmesano, aderezo césar', precio: 18000, tipo: 'plato', categoria: 'Platos principales' },
  { nombre: 'Jugo de naranja natural', descripcion: 'Recién exprimido', precio: 6000, tipo: 'bebida', categoria: 'Bebidas' },
  { nombre: 'Café americano', descripcion: 'Café de grano colombiano', precio: 5000, tipo: 'bebida', categoria: 'Bebidas' },
  { nombre: 'Limonada', descripcion: 'Limón, agua, azúcar, hielo', precio: 5500, tipo: 'bebida', categoria: 'Bebidas' },
  { nombre: 'Tiramisú', descripcion: 'Clásico italiano con café y mascarpone', precio: 12000, tipo: 'postre', categoria: 'Postres' },
  { nombre: 'Flan de leche', descripcion: 'Flan casero con caramelo', precio: 8000, tipo: 'postre', categoria: 'Postres' },
  { nombre: 'Papas fritas', descripcion: 'Porción de papas fritas crujientes', precio: 8000, tipo: 'adicional', categoria: 'Adicionales' },
  { nombre: 'Arroz blanco', descripcion: 'Porción de arroz blanco', precio: 4000, tipo: 'adicional', categoria: 'Adicionales' },
]

const BASE_TABLES = [
  { numero: 1, capacidad: 2 },
  { numero: 2, capacidad: 2 },
  { numero: 3, capacidad: 4 },
  { numero: 4, capacidad: 4 },
  { numero: 5, capacidad: 6 },
  { numero: 6, capacidad: 6 },
  { numero: 7, capacidad: 8 },
  { numero: 8, capacidad: 8 },
]

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function parseRestaurants() {
  const json = process.env.SEED_RESTAURANTS_JSON?.trim()
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('SEED_RESTAURANTS_JSON must be a non-empty array')
      }
      return parsed.map((r, i) => {
        if (!r.slug || !r.nombre || !r.adminEmail || !r.adminPassword) {
          throw new Error(`SEED_RESTAURANTS_JSON[${i}] missing required fields: slug, nombre, adminEmail, adminPassword`)
        }
        if (!r.adminEmail.toLowerCase().endsWith('@glotoncitos.com')) {
          throw new Error(`SEED_RESTAURANTS_JSON[${i}] adminEmail must end in @glotoncitos.com`)
        }
        if (r.adminPassword.length < 12 || r.adminPassword.length > 128) {
          throw new Error(`SEED_RESTAURANTS_JSON[${i}] adminPassword must be 12-128 characters`)
        }
        return {
          slug: r.slug.trim(),
          nombre: r.nombre.trim(),
          nit: r.nit?.trim() || null,
          adminEmail: r.adminEmail.trim().toLowerCase(),
          adminPassword: r.adminPassword,
        }
      })
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('SEED_RESTAURANTS_JSON is invalid JSON')
      throw error
    }
  }

  const slug = required('SEED_BUSINESS_SLUG')
  const nombre = required('SEED_BUSINESS_NAME')
  const adminEmail = required('SEED_ADMIN_EMAIL')
  const adminPassword = required('SEED_ADMIN_PASSWORD')
  if (!adminEmail.toLowerCase().endsWith('@glotoncitos.com')) {
    throw new Error('SEED_ADMIN_EMAIL must end in @glotoncitos.com')
  }
  if (adminPassword.length < 12 || adminPassword.length > 128) {
    throw new Error('SEED_ADMIN_PASSWORD must be 12-128 characters')
  }
  return [{ slug, nombre, nit: null, adminEmail: adminEmail.trim().toLowerCase(), adminPassword }]
}

function parseUsers(restaurantSlug) {
  const json = process.env.SEED_USERS_JSON?.trim()
  let users = []
  if (json) {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) {
        throw new Error('SEED_USERS_JSON must be an array')
      }
      users = parsed.map((u, i) => {
        if (!u.email || !u.password || !u.roleCode || !u.name) {
          throw new Error(`SEED_USERS_JSON[${i}] missing required fields: email, password, roleCode, name`)
        }
        if (!u.email.toLowerCase().endsWith('@glotoncitos.com')) {
          throw new Error(`SEED_USERS_JSON[${i}] email must end in @glotoncitos.com`)
        }
        if (u.password.length < 12 || u.password.length > 128) {
          throw new Error(`SEED_USERS_JSON[${i}] password must be 12-128 characters`)
        }
        const roleCode = u.roleCode.trim().toLowerCase()
        if (!['mesero', 'cajero', 'cocina'].includes(roleCode)) {
          throw new Error(`SEED_USERS_JSON[${i}] roleCode must be mesero, cajero, or cocina (not admin)`)
        }
        return {
          email: u.email.trim().toLowerCase(),
          password: u.password,
          roleCode,
          name: u.name.trim(),
        }
      })
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('SEED_USERS_JSON is invalid JSON')
      throw error
    }
  }

  for (const roleCode of ['mesero', 'cajero', 'cocina']) {
    const prefix = `SEED_${roleCode.toUpperCase()}`
    const email = process.env[`${prefix}_EMAIL`]
    const password = process.env[`${prefix}_PASSWORD`]
    const name = process.env[`${prefix}_NAME`]
    if (!email || !password || !name) continue
    if (!email.toLowerCase().endsWith('@glotoncitos.com')) {
      throw new Error(`${prefix}_EMAIL must end in @glotoncitos.com`)
    }
    if (password.length < 12 || password.length > 128) {
      throw new Error(`${prefix}_PASSWORD must be 12-128 characters`)
    }
    users.push({ email: email.trim().toLowerCase(), password, roleCode, name: name.trim() })
  }

  return users
}

async function seedRestaurant(client, restaurant, users) {
  const restaurantResult = await client.query(
    `INSERT INTO restaurantes (slug, nombre, nit, correo_admin, estado_suscripcion)
     VALUES ($1, $2, $3, $4, 'activa')
     ON CONFLICT (slug) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       nit = EXCLUDED.nit,
       correo_admin = EXCLUDED.correo_admin,
       estado_suscripcion = 'activa',
       actualizado_en = now()
     RETURNING id_restaurante`,
    [restaurant.slug, restaurant.nombre, restaurant.nit, restaurant.adminEmail],
  )
  const restaurantId = restaurantResult.rows[0].id_restaurante

  const rolesResult = await client.query('SELECT id_rol, codigo FROM roles ORDER BY codigo')
  const rolesByCode = new Map(rolesResult.rows.map((role) => [role.codigo, role.id_rol]))

  const adminHash = await bcrypt.hash(restaurant.adminPassword, 12)
  const adminResult = await client.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_restaurante, creado_por)
     VALUES ($1, $2, $3, $4, $5, NULL)
     ON CONFLICT (correo) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       password_hash = EXCLUDED.password_hash,
       id_rol = EXCLUDED.id_rol,
       id_restaurante = EXCLUDED.id_restaurante,
       estado = true,
       actualizado_en = now()
     RETURNING id_usuario`,
    [restaurant.nombre + ' Admin', restaurant.adminEmail, adminHash, rolesByCode.get('admin'), restaurantId],
  )
  const adminId = adminResult.rows[0].id_usuario

  await client.query(
    `INSERT INTO categorias (nombre, descripcion)
     SELECT unnest($1::text[]), unnest($2::text[])
     ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion`,
    [BASE_CATEGORIES.map(c => c.nombre), BASE_CATEGORIES.map(c => c.descripcion)],
  )
  const categoriesResult = await client.query(
    'SELECT id_categoria, nombre FROM categorias ORDER BY nombre',
  )
  const categoriesByName = new Map(categoriesResult.rows.map(c => [c.nombre, c.id_categoria]))

  for (const product of BASE_PRODUCTS) {
    const categoryId = categoriesByName.get(product.categoria)
    if (!categoryId) continue
    await client.query(
      `INSERT INTO productos (id_restaurante, id_categoria, nombre, descripcion, precio, tipo, disponible)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id_restaurante, nombre) DO UPDATE SET
         id_categoria = EXCLUDED.id_categoria,
         descripcion = EXCLUDED.descripcion,
         precio = EXCLUDED.precio,
         tipo = EXCLUDED.tipo,
         disponible = true,
         actualizado_en = now()`,
      [restaurantId, categoryId, product.nombre, product.descripcion, product.precio, product.tipo],
    )
  }

  const resultadoPiso = await client.query(
    `INSERT INTO pisos (id_restaurante, numero)
     VALUES ($1, 1)
     ON CONFLICT (id_restaurante, numero) DO UPDATE SET actualizado_en = now()
     RETURNING id_piso`,
    [restaurantId],
  )
  const idPiso = resultadoPiso.rows[0].id_piso

  for (const table of BASE_TABLES) {
    await client.query(
      `INSERT INTO mesas (id_restaurante, id_piso, numero, capacidad, estado)
       VALUES ($1, $2, $3, $4, 'libre')
       ON CONFLICT (id_restaurante, id_piso, numero) DO UPDATE SET
         capacidad = EXCLUDED.capacidad,
         estado = 'libre',
         ocupada_desde = NULL,
         ocupada_personas = NULL,
         actualizado_en = now()`,
      [restaurantId, idPiso, table.numero, table.capacidad],
    )
  }

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 12)
    const roleId = rolesByCode.get(user.roleCode)
    await client.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_restaurante, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (correo) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         password_hash = EXCLUDED.password_hash,
         id_rol = EXCLUDED.id_rol,
         id_restaurante = EXCLUDED.id_restaurante,
         estado = true,
         actualizado_en = now()`,
      [user.name, user.email, hash, roleId, restaurantId, adminId],
    )
  }
}

async function seed() {
  const restaurants = parseRestaurants()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const restaurant of restaurants) {
      const users = parseUsers(restaurant.slug)
      await seedRestaurant(client, restaurant, users)
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