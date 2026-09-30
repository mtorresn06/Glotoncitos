import { pool } from '../db/pool.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import {
  normalizeBoolean,
  normalizeName,
  normalizePrice,
  normalizeProductType,
  normalizeUuid,
} from '../utils/validation.js'

export function formatCategory(row) {
  return {
    id: row.id_categoria,
    name: row.nombre,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }
}

export function formatProduct(row) {
  return {
    id: row.id_producto,
    restaurantId: row.id_restaurante,
    categoryId: row.id_categoria,
    categoryName: row.categoria_nombre,
    name: row.nombre,
    description: row.descripcion,
    price: Number(row.precio),
    type: row.tipo,
    available: row.disponible,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  }
}

export async function listCategories() {
  const result = await pool.query(
    `SELECT id_categoria, nombre, creado_en, actualizado_en
     FROM categorias
     ORDER BY nombre`,
  )
  return result.rows.map(formatCategory)
}

export async function createCategory({ name }) {
  const normalizedName = normalizeName(name, 'Category name')
  const result = await pool.query(
    `INSERT INTO categorias (nombre)
     VALUES ($1)
     RETURNING id_categoria, nombre, creado_en, actualizado_en`,
    [normalizedName],
  )
  return formatCategory(result.rows[0])
}

export async function updateCategory(categoryId, { name }) {
  const id = normalizeUuid(categoryId, 'Category id')
  const normalizedName = normalizeName(name, 'Category name')
  const result = await pool.query(
    `UPDATE categorias
     SET nombre = $1, actualizado_en = now()
     WHERE id_categoria = $2
     RETURNING id_categoria, nombre, creado_en, actualizado_en`,
    [normalizedName, id],
  )
  if (result.rowCount === 0) throw notFound('Category not found')
  return formatCategory(result.rows[0])
}

export async function deleteCategory(categoryId) {
  const id = normalizeUuid(categoryId, 'Category id')
  try {
    const result = await pool.query('DELETE FROM categorias WHERE id_categoria = $1', [id])
    if (result.rowCount === 0) throw notFound('Category not found')
  } catch (error) {
    if (error?.code === '23503') throw conflict('Category is used by products')
    throw error
  }
}

function normalizarNombreCategoria(nombre) {
  if (typeof nombre !== 'string' || !nombre.trim()) {
    throw badRequest('El nombre de la categoría es obligatorio')
  }
  const limpio = nombre.trim()
  if (limpio.length > 60) throw badRequest('El nombre de la categoría no puede superar 60 caracteres')
  return limpio
}

export async function crearCategoria({ nombre }) {
  const normalizedName = normalizarNombreCategoria(nombre)
  const result = await pool.query(
    `INSERT INTO categorias (nombre)
     VALUES ($1)
     RETURNING id_categoria, nombre, creado_en, actualizado_en`,
    [normalizedName],
  )
  return formatCategory(result.rows[0])
}

export async function actualizarCategoria(categoryId, { nombre }) {
  const id = normalizeUuid(categoryId, 'Id de categoría')
  const normalizedName = normalizarNombreCategoria(nombre)
  const result = await pool.query(
    `UPDATE categorias
     SET nombre = $1, actualizado_en = now()
     WHERE id_categoria = $2
     RETURNING id_categoria, nombre, creado_en, actualizado_en`,
    [normalizedName, id],
  )
  if (result.rowCount === 0) throw notFound('Categoría no encontrada')
  return formatCategory(result.rows[0])
}

export async function eliminarCategoria(categoryId) {
  const id = normalizeUuid(categoryId, 'Id de categoría')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const categoria = await client.query(
      'SELECT id_categoria FROM categorias WHERE id_categoria = $1 FOR UPDATE',
      [id],
    )
    if (categoria.rowCount === 0) throw notFound('Categoría no encontrada')

    const productos = await client.query(
      'SELECT nombre FROM productos WHERE id_categoria = $1 ORDER BY nombre LIMIT 1',
      [id],
    )
    if (productos.rowCount > 0) {
      throw conflict(`La categoría tiene el producto "${productos.rows[0].nombre}"; muévelo a otra categoría antes de eliminarla`)
    }

    await client.query('DELETE FROM categorias WHERE id_categoria = $1', [id])
    await client.query('COMMIT')
    return { id }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error?.code === '23503') throw conflict('La categoría tiene productos asociados')
    throw error
  } finally {
    client.release()
  }
}

export async function listProducts(restaurantId, { availableOnly = false } = {}) {
  const id = normalizeUuid(restaurantId, 'Restaurant id')
  const result = await pool.query(
    `SELECT p.id_producto, p.id_restaurante, p.id_categoria, c.nombre AS categoria_nombre,
            p.nombre, p.descripcion, p.precio, p.tipo, p.disponible,
            p.creado_en, p.actualizado_en
     FROM productos p
     JOIN categorias c ON c.id_categoria = p.id_categoria
     WHERE p.id_restaurante = $1
       AND ($2 = false OR p.disponible = true)
     ORDER BY c.nombre, p.nombre`,
    [id, availableOnly],
  )
  return result.rows.map(formatProduct)
}

export async function createProduct({ restaurantId, categoryId, name, description = '', price, type = 'plato', available = true }) {
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const idCategory = normalizeUuid(categoryId, 'Category id')
  const normalizedName = normalizeName(name, 'Product name')
  const normalizedDescription = description === undefined ? '' : String(description).trim().slice(0, 500)
  const normalizedPrice = normalizePrice(price)
  const normalizedType = normalizeProductType(type)
  const normalizedAvailable = normalizeBoolean(available, 'Available')
  const category = await pool.query('SELECT id_categoria FROM categorias WHERE id_categoria = $1', [idCategory])
  if (category.rowCount === 0) throw notFound('Category not found')

  const result = await pool.query(
    `INSERT INTO productos
      (id_restaurante, id_categoria, nombre, descripcion, precio, tipo, disponible)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_producto, id_restaurante, id_categoria, nombre, descripcion,
               precio, tipo, disponible, creado_en, actualizado_en`,
    [idRestaurant, idCategory, normalizedName, normalizedDescription, normalizedPrice, normalizedType, normalizedAvailable],
  )
  return getProduct(result.rows[0].id_producto, idRestaurant)
}

export async function updateProduct(productId, restaurantId, updates) {
  const id = normalizeUuid(productId, 'Product id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const current = await pool.query(
    `SELECT id_producto, id_restaurante, id_categoria, nombre, descripcion,
            precio, tipo, disponible
     FROM productos
     WHERE id_producto = $1 AND id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (current.rowCount === 0) throw notFound('Product not found')

  const product = current.rows[0]
  const name = updates.name === undefined ? product.nombre : normalizeName(updates.name, 'Product name')
  const description = updates.description === undefined
    ? product.descripcion
    : String(updates.description).trim().slice(0, 500)
  const price = updates.price === undefined ? Number(product.precio) : normalizePrice(updates.price)
  const type = updates.type === undefined ? product.tipo : normalizeProductType(updates.type)
  const available = updates.available === undefined
    ? product.disponible
    : normalizeBoolean(updates.available, 'Available')
  const categoryId = updates.categoryId === undefined
    ? product.id_categoria
    : normalizeUuid(updates.categoryId, 'Category id')
  const category = await pool.query('SELECT id_categoria FROM categorias WHERE id_categoria = $1', [categoryId])
  if (category.rowCount === 0) throw notFound('Category not found')

  await pool.query(
    `UPDATE productos
     SET id_categoria = $1, nombre = $2, descripcion = $3, precio = $4,
         tipo = $5, disponible = $6, actualizado_en = now()
     WHERE id_producto = $7 AND id_restaurante = $8
     RETURNING id_producto, id_restaurante, id_categoria, nombre, descripcion,
               precio, tipo, disponible, creado_en, actualizado_en`,
    [categoryId, name, description, price, type, available, id, idRestaurant],
  )
  return getProduct(id, idRestaurant)
}

export async function deleteProduct(productId, restaurantId) {
  const id = normalizeUuid(productId, 'Product id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  try {
    const result = await pool.query(
      'DELETE FROM productos WHERE id_producto = $1 AND id_restaurante = $2',
      [id, idRestaurant],
    )
    if (result.rowCount === 0) throw notFound('Product not found')
  } catch (error) {
    if (error?.code === '23503') throw conflict('Product is used by orders')
    throw error
  }
}

export async function eliminarProducto(productId, restaurantId) {
  const id = normalizeUuid(productId, 'Id de producto')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const producto = await client.query(
      'SELECT id_producto FROM productos WHERE id_producto = $1 AND id_restaurante = $2 FOR UPDATE',
      [id, idRestaurant],
    )
    if (producto.rowCount === 0) throw notFound('Producto no encontrado')

    const historial = await client.query(
      `SELECT p.estado, m.numero AS mesa
       FROM detalles_pedido dp
       JOIN pedidos p ON p.id_pedido = dp.id_pedido
       JOIN mesas m ON m.id_mesa = p.id_mesa
       WHERE dp.id_producto = $1 AND dp.id_restaurante = $2
       ORDER BY p.creado_en DESC
       LIMIT 1`,
      [id, idRestaurant],
    )

    if (historial.rowCount > 0) {
      const pedido = historial.rows[0]
      const activo = !['cerrado', 'cancelado'].includes(pedido.estado)
      const detalle = activo
        ? `tiene una cuenta abierta en la mesa ${pedido.mesa}; ciérrala o cancélala antes de eliminarlo`
        : 'tiene historial de pedidos y no se puede eliminar'
      throw conflict(`El producto ${detalle}. Si solo quieres quitarlo del menú, desactívalo.`)
    }

    await client.query('DELETE FROM productos WHERE id_producto = $1 AND id_restaurante = $2', [
      id,
      idRestaurant,
    ])
    await client.query('COMMIT')
    return { id }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error?.code === '23503') throw conflict('El producto está en uso')
    throw error
  } finally {
    client.release()
  }
}

export async function getProduct(productId, restaurantId) {
  const id = normalizeUuid(productId, 'Product id')
  const idRestaurant = normalizeUuid(restaurantId, 'Restaurant id')
  const result = await pool.query(
    `SELECT p.id_producto, p.id_restaurante, p.id_categoria, c.nombre AS categoria_nombre,
            p.nombre, p.descripcion, p.precio, p.tipo, p.disponible,
            p.creado_en, p.actualizado_en
     FROM productos p
     JOIN categorias c ON c.id_categoria = p.id_categoria
     WHERE p.id_producto = $1 AND p.id_restaurante = $2`,
    [id, idRestaurant],
  )
  if (result.rowCount === 0) throw notFound('Product not found')
  return formatProduct(result.rows[0])
}
