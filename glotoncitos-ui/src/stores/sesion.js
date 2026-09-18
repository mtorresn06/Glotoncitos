import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { login } from '../services/api.js'

const STORAGE_KEY = 'glotoncitos-sesion'

export const ROLES = {
  administrador: {
    id: 'administrador',
    codigoBackend: 'admin',
    nombre: 'Administrador',
    descripcion: 'Ve el Dashboard con las métricas del negocio',
    pantalla: '/dashboard',
    titulo: 'Dashboard',
    color: 'bg-cafe-700',
    colorClaro: 'bg-cafe-100',
  },
  mesero: {
    id: 'mesero',
    codigoBackend: 'mesero',
    nombre: 'Mesero',
    descripcion: 'Atiende mesas y arma los pedidos',
    pantalla: '/mesas',
    titulo: 'Panel de Mesas',
    color: 'bg-durazno-500',
    colorClaro: 'bg-durazno-100',
  },
  cocina: {
    id: 'cocina',
    codigoBackend: 'cocina',
    nombre: 'Cocina',
    descripcion: 'Prepara los pedidos en tiempo real',
    pantalla: '/cocina',
    titulo: 'Panel de Cocina',
    color: 'bg-amber-600',
    colorClaro: 'bg-amber-100',
  },
  cajero: {
    id: 'cajero',
    codigoBackend: 'cajero',
    nombre: 'Cajero',
    descripcion: 'Cierra cuentas y registra los pagos',
    pantalla: '/caja',
    titulo: 'Panel de Caja',
    color: 'bg-green-700',
    colorClaro: 'bg-green-100',
  },
}

const rolesPorCodigo = Object.fromEntries(
  Object.values(ROLES).map((rol) => [rol.codigoBackend, rol.id]),
)
const prioridadRoles = ['administrador', 'mesero', 'cajero', 'cocina']

function guardarSesion(sesion) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion))
}

function obtenerSesionGuardada() {
  try {
    const sesion = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!sesion?.access_token || !sesion.user) return null
    return sesion
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useSesionStore = defineStore('sesion', () => {
  const token = ref(null)
  const usuario = ref(null)
  const roles = ref([])
  const rolId = ref(null)
  const cargando = ref(false)
  const error = ref('')

  const rolActivo = computed(() => (rolId.value ? ROLES[rolId.value] : null))

  function aplicarSesion(sesion) {
    token.value = sesion.access_token
    usuario.value = sesion.user
    roles.value = sesion.user.roles || []

    const rolesDisponibles = roles.value
      .map((rol) => rolesPorCodigo[rol.code])
      .filter(Boolean)
      .sort((a, b) => prioridadRoles.indexOf(a) - prioridadRoles.indexOf(b))

    rolId.value = rolesDisponibles[0] || null
    guardarSesion(sesion)
    error.value = ''
  }

  function restaurarSesion() {
    const sesion = obtenerSesionGuardada()
    if (sesion) aplicarSesion(sesion)
  }

  async function iniciarSesion(credenciales) {
    cargando.value = true
    error.value = ''

    try {
      const sesion = await login(credenciales)
      aplicarSesion(sesion)
      return sesion
    } catch (errorDeLogin) {
      error.value = errorDeLogin.message || 'No se pudo iniciar sesión'
      throw errorDeLogin
    } finally {
      cargando.value = false
    }
  }

  function elegirRol(nuevoRolId) {
    if (!ROLES[nuevoRolId]) return
    rolId.value = nuevoRolId
    if (token.value && usuario.value) {
      guardarSesion({ access_token: token.value, user: usuario.value })
    }
  }

  function cerrarSesion() {
    token.value = null
    usuario.value = null
    roles.value = []
    rolId.value = null
    error.value = ''
    localStorage.removeItem(STORAGE_KEY)
  }

  restaurarSesion()

  return {
    token,
    usuario,
    roles,
    rolId,
    rolActivo,
    cargando,
    error,
    iniciarSesion,
    elegirRol,
    cerrarSesion,
  }
})
