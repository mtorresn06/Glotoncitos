export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function notFound(message = 'Resource not found') {
  return new HttpError(404, 'NOT_FOUND', message)
}

export function unauthorized(message = 'Invalid email or password') {
  return new HttpError(401, 'UNAUTHORIZED', message)
}

export function forbidden(message = 'You do not have permission to perform this action') {
  return new HttpError(403, 'FORBIDDEN', message)
}

export function conflict(message, details) {
  return new HttpError(409, 'CONFLICT', message, details)
}

export function badRequest(message, details) {
  return new HttpError(400, 'BAD_REQUEST', message, details)
}
