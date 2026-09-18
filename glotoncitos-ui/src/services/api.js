const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')

async function request(ruta, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_URL}${ruta}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.error?.message || 'No se pudo conectar con el servidor')
    error.status = response.status
    throw error
  }

  return data
}

export function login(credenciales) {
  return request('/auth/login', {
    method: 'POST',
    body: credenciales,
  })
}
