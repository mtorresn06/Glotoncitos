import { badRequest } from './errors.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  if (typeof value !== 'string') throw badRequest('Email must be a string')
  const email = value.trim().toLowerCase()
  if (!emailPattern.test(email) || email.length > 254) {
    throw badRequest('Enter a valid email address')
  }
  return email
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw badRequest('Password must contain between 12 and 128 characters')
  }
  return value
}

export function normalizeRoleCodes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest('At least one role is required')
  }

  const roleCodes = [...new Set(value.map((roleCode) => {
    if (typeof roleCode !== 'string') throw badRequest('Role codes must be strings')
    return roleCode.trim().toLowerCase()
  }))]

  if (roleCodes.some((roleCode) => !/^[a-z][a-z0-9_]*$/.test(roleCode))) {
    throw badRequest('Role codes are invalid')
  }

  return roleCodes
}
