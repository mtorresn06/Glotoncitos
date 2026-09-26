import { badRequest } from './errors.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const glotoncitosEmailPattern = /^[^\s@]+@glotoncitos\.com$/i
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw badRequest('Email must be a string')
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email)) throw badRequest('Email is invalid')
  return email
}

export function normalizeGlotoncitosEmail(value) {
  const email = normalizeEmail(value)
  if (!glotoncitosEmailPattern.test(email)) {
    throw badRequest('Email must end in @glotoncitos.com')
  }
  return email
}

export function normalizeName(value, fieldName = 'Name') {
  if (typeof value !== 'string') throw badRequest(`${fieldName} must be a string`)
  const name = value.trim()
  if (!name || name.length > 120) throw badRequest(`${fieldName} is required`)
  return name
}

export function normalizeDescription(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw badRequest('Description must be a string')
  const description = value.trim()
  if (description.length > 500) throw badRequest('Description is too long')
  return description
}

export function normalizePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw badRequest('Password must contain between 12 and 128 characters')
  }
  return value
}

export function validatePassword(value) {
  return normalizePassword(value)
}

export function normalizeRoleCode(value) {
  if (typeof value !== 'string') throw badRequest('Role code must be a string')
  const roleCode = value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(roleCode)) throw badRequest('Role code is invalid')
  return roleCode
}

export function normalizeRoleCodes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest('At least one role is required')
  }

  const roleCodes = [...new Set(value.map(normalizeRoleCode))]
  return roleCodes
}

export function normalizeUuid(value, fieldName = 'Id') {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw badRequest(`${fieldName} is invalid`)
  }
  return value.toLowerCase()
}

export function normalizePrice(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
    throw badRequest('Price is invalid')
  }
  return Math.round(price * 100) / 100
}

export function normalizePositiveInteger(value, fieldName = 'Value') {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0 || number > 100000) {
    throw badRequest(`${fieldName} is invalid`)
  }
  return number
}

export function normalizeQuantity(value) {
  return normalizePositiveInteger(value, 'Quantity')
}

export function normalizeBoolean(value, fieldName = 'Value') {
  if (typeof value !== 'boolean') throw badRequest(`${fieldName} must be a boolean`)
  return value
}

export function normalizeProductType(value) {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const allowed = new Set(['plato', 'bebida', 'postre', 'adicional', 'otro'])
  if (!allowed.has(type)) throw badRequest('Product type is invalid')
  return type
}

export function normalizeTableStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const allowed = new Set(['libre', 'sin_atender', 'atendida', 'reservada'])
  if (!allowed.has(status)) throw badRequest('Table status is invalid')
  return status
}

export function normalizeOrderStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const allowed = new Set(['pendiente', 'en_preparacion', 'listo', 'cerrado', 'cancelado'])
  if (!allowed.has(status)) throw badRequest('Order status is invalid')
  return status
}

export function normalizeDetailStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const allowed = new Set(['pendiente', 'en_preparacion', 'listo', 'cancelado'])
  if (!allowed.has(status)) throw badRequest('Item status is invalid')
  return status
}

export function normalizePaymentMethod(value) {
  const method = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!['efectivo', 'transferencia'].includes(method)) {
    throw badRequest('Payment method is invalid')
  }
  return method
}

export function normalizeNotes(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw badRequest('Notes must be a string')
  const notes = value.trim()
  if (notes.length > 500) throw badRequest('Notes are too long')
  return notes
}

export function normalizeDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`${fieldName} is invalid`)
  return date
}
