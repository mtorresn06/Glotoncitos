<script setup>
import { computed, onMounted, ref } from 'vue'
import { useSesionStore } from '../stores/sesion'
import { useDatosStore } from '../stores/datos'
import { formatearPrecio } from '../utils/formato'
import {
  crearTrabajador as crearTrabajadorAPI,
  getTrabajadores,
  eliminarTrabajador as eliminarTrabajadorAPI,
  actualizarTrabajador,
  getMenuCategorias,
  getMenuProductos,
  crearProductoMenu,
  actualizarProductoMenu,
  eliminarProductoMenu,
} from '../services/api.js'

const sesion = useSesionStore()
const datos = useDatosStore()

// Estados para el modal visual rápido
const modalAbierto = ref(false)
const modoTextoModal = ref('')
const nombreTrabajadorForm = ref('')
const correoTrabajadorForm = ref('')
const restauranteTrabajadorForm = ref('')
const passwordTrabajadorForm = ref('')
const rolTrabajadorForm = ref('mesero')
const trabajadorEditandoId = ref(null)
const errorFormularioTrabajador = ref('')
const rolesDisponibles = [
  { code: 'mesero', name: 'Mesero' },
  { code: 'cajero', name: 'Cajero' },
  { code: 'cocina', name: 'Cocina' },
]

const menuGestionAbierto = ref(false)
const menuModalAbierto = ref(false)
const menuCargando = ref(false)
const menuError = ref('')
const menuProductos = ref([])
const menuCategorias = ref([])
const menuFiltroCategoria = ref('todas')
const productoEditandoId = ref(null)
const productoForm = ref({
  categoryId: '',
  name: '',
  description: '',
  price: '',
  type: 'plato',
  available: true,
})
const tiposProducto = [
  { code: 'plato', name: 'Plato' },
  { code: 'bebida', name: 'Bebida' },
  { code: 'postre', name: 'Postre' },
  { code: 'adicional', name: 'Adicional' },
  { code: 'otro', name: 'Otro' },
]

onMounted(async () => {
  await datos.cargarDatos()
  if (esAdmin.value) await cargarMenuAdministracion()
})

const maximoPlatos = computed(() => {
  const cantidades = datos.platosMasPedidos.map((p) => p.cantidad)
  return cantidades.length ? Math.max(...cantidades) : 1
})

// Validación robusta para el rol de administrador
const esAdmin = computed(() => {
  const code = sesion.rolActivo?.code || sesion.rolActivo?.codigo || ''
  const nombre = sesion.rolActivo?.nombre || ''
  return code === 'admin' || nombre.toLowerCase() === 'administrador'
})

const esEdicion = computed(() => Boolean(trabajadorEditandoId.value))
const restauranteIdActual = computed(() => {
  return sesion.usuario?.restaurant?.id ||
         sesion.usuario?.restaurantId ||
         sesion.restaurantActivo?.id ||
         sesion.usuario?.id_restaurante || ''
})

const tarjetas = computed(() => [
  { titulo: 'Ventas del día', valor: formatearPrecio(datos.ventasDelDia), detalle: 'Suma de las cuentas cerradas', color: 'text-cafe-800' },
  { titulo: 'Pedidos', valor: String(datos.numeroPedidos), detalle: 'Activos + cerrados hoy', color: 'text-cafe-800' },
  { titulo: 'Mesas ocupadas', valor: String(datos.mesasOcupadas.length), detalle: `${datos.mesas.length} mesas en total`, color: 'text-durazno-500' },
  { titulo: 'Mesas libres', valor: String(datos.mesasLibres.length), detalle: 'Disponibles para atender', color: 'text-green-700' },
])

const trabajadoresVisibles = computed(() => datos.trabajadores.filter(
  (trabajador) => trabajador.id !== sesion.usuario?.id,
))

const opcionesFiltroMenu = computed(() => [
  { id: 'todas', name: 'Todas las categorías' },
  ...menuCategorias.value,
])

const productosMenuFiltrados = computed(() => {
  if (menuFiltroCategoria.value === 'todas') return menuProductos.value
  return menuProductos.value.filter((producto) => producto.categoryId === menuFiltroCategoria.value)
})

const esEdicionProducto = computed(() => Boolean(productoEditandoId.value))

function abrirGestionMenu() {
  menuGestionAbierto.value = !menuGestionAbierto.value
  if (menuGestionAbierto.value) cargarMenuAdministracion()
}

async function cargarMenuAdministracion() {
  menuCargando.value = true
  menuError.value = ''
  try {
    const [categorias, productos] = await Promise.all([
      getMenuCategorias(),
      getMenuProductos(),
    ])
    menuCategorias.value = categorias.categories || []
    menuProductos.value = productos.products || []
    if (!menuCategorias.value.some((categoria) => categoria.id === menuFiltroCategoria.value)) {
      menuFiltroCategoria.value = 'todas'
    }
  } catch (error) {
    menuError.value = error.message || 'No se pudo cargar el menú'
  } finally {
    menuCargando.value = false
  }
}

function abrirProductoNuevo() {
  productoEditandoId.value = null
  productoForm.value = {
    categoryId: menuCategorias.value[0]?.id || '',
    name: '',
    description: '',
    price: '',
    type: 'plato',
    available: true,
  }
  menuError.value = ''
  menuModalAbierto.value = true
}

function abrirProductoEditar(producto) {
  productoEditandoId.value = producto.id
  productoForm.value = {
    categoryId: producto.categoryId || '',
    name: producto.name || '',
    description: producto.description || '',
    price: producto.price ?? '',
    type: producto.type || 'plato',
    available: Boolean(producto.available),
  }
  menuError.value = ''
  menuModalAbierto.value = true
}

function cerrarProductoModal() {
  menuModalAbierto.value = false
  productoEditandoId.value = null
}

async function guardarProducto() {
  menuError.value = ''
  const precio = Number(productoForm.value.price)
  if (!productoForm.value.categoryId || !productoForm.value.name.trim() || !Number.isFinite(precio) || precio < 0) {
    menuError.value = 'Completa la categoría, el nombre y un precio válido'
    return
  }

  const datosProducto = {
    categoryId: productoForm.value.categoryId,
    name: productoForm.value.name.trim(),
    description: productoForm.value.description.trim(),
    price: precio,
    type: productoForm.value.type,
    available: productoForm.value.available,
  }

  try {
    if (productoEditandoId.value) {
      await actualizarProductoMenu(productoEditandoId.value, datosProducto)
    } else {
      await crearProductoMenu(datosProducto)
    }
    cerrarProductoModal()
    await Promise.all([cargarMenuAdministracion(), datos.cargarDatos()])
  } catch (error) {
    menuError.value = error.message || 'No se pudo guardar el producto'
  }
}

async function eliminarProducto(producto) {
  if (!confirm(`¿Eliminar "${producto.name}" del menú?`)) return
  try {
    await eliminarProductoMenu(producto.id)
    await Promise.all([cargarMenuAdministracion(), datos.cargarDatos()])
  } catch (error) {
    menuError.value = error.message || 'No se pudo eliminar el producto'
  }
}

function abrirModalNuevo() {
  modoTextoModal.value = 'Agregar Nuevo Trabajador'
  nombreTrabajadorForm.value = ''
  correoTrabajadorForm.value = ''
  // Forzamos la lectura directa por si acaso
  restauranteTrabajadorForm.value = sesion.usuario?.restaurant?.id || sesion.usuario?.restaurantId || ''
  passwordTrabajadorForm.value = ''
  rolTrabajadorForm.value = 'mesero'
  errorFormularioTrabajador.value = ''
  modalAbierto.value = true
}

function abrirEditarTrabajador(trabajador) {
  trabajadorEditandoId.value = trabajador.id
  modoTextoModal.value = `Editar Trabajador: ${trabajador.nombre || trabajador.name}`
  nombreTrabajadorForm.value = trabajador.nombre || trabajador.name || ''
  correoTrabajadorForm.value = trabajador.correo || trabajador.email || ''
  restauranteTrabajadorForm.value = trabajador.restaurantId || restauranteIdActual.value
  passwordTrabajadorForm.value = ''
  rolTrabajadorForm.value = trabajador.roleCode || rolesDisponibles.find(
    (rol) => rol.name.toLowerCase() === (trabajador.roleName || trabajador.rol || '').toLowerCase(),
  )?.code || 'mesero'
  errorFormularioTrabajador.value = ''
  modalAbierto.value = true
}

function cerrarModal() {
  modalAbierto.value = false
  trabajadorEditandoId.value = null
}

async function guardarTrabajador() {
  errorFormularioTrabajador.value = ''
  const restauranteId = restauranteTrabajadorForm.value.trim() || restauranteIdActual.value
  const nombre = nombreTrabajadorForm.value.trim()
  const correo = correoTrabajadorForm.value.trim()
  const password = passwordTrabajadorForm.value

  if (!nombre || !correo || !restauranteId) {
    errorFormularioTrabajador.value = 'Completa el nombre, el correo y el restaurante'
    return
  }

  try {
    if (trabajadorEditandoId.value) {
      await actualizarTrabajador(trabajadorEditandoId.value, {
        name: nombre,
        email: correo,
        roleCode: rolTrabajadorForm.value,
      })
    } else {
      if (!password) {
        errorFormularioTrabajador.value = 'Completa la contraseña inicial'
        return
      }
      await crearTrabajadorAPI({
        name: nombre,
        email: correo,
        id_restaurante: restauranteId,
        restaurantId: restauranteId,
        password,
        roleCode: rolTrabajadorForm.value,
      })
    }
    cerrarModal()
    await datos.cargarDatos()
  } catch (error) {
    errorFormularioTrabajador.value = error.message || 'No se pudo guardar el trabajador'
  }
}

async function eliminarTrabajador(id) {
  if (!confirm('¿Estás seguro de eliminar este trabajador?')) return
  try {
    await eliminarTrabajadorAPI(id)
    await datos.cargarDatos() // Recargar la lista
  } catch (err) {
    alert(err.message || 'Error al eliminar')
  }
}
</script>

<template>
  <div class="pt-8">
    <div class="mb-6">
      <h1 class="text-2xl font-extrabold tracking-tight text-cafe-800">Dashboard</h1>
      <p class="text-sm text-cafe-500">
        Resumen del día para {{ sesion.rolActivo?.nombre?.toLowerCase() }}
      </p>
    </div>

    <div v-if="datos.cargando" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cafe-700"></div>
    </div>

    <div v-else-if="datos.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="text-sm">{{ datos.error }}</p>
      <button class="mt-2 rounded-lg bg-cafe-700 px-4 py-2 text-sm font-bold text-crema-50"
        @click="datos.cargarDatos">Reintentar</button>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="tarjeta in tarjetas" :key="tarjeta.titulo"
          class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm">
          <p class="text-xs font-bold uppercase tracking-wide text-cafe-500">{{ tarjeta.titulo }}</p>
          <p class="mt-1 text-3xl font-extrabold" :class="tarjeta.color">{{ tarjeta.valor }}</p>
          <p class="mt-1 text-xs text-cafe-400">{{ tarjeta.detalle }}</p>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 class="mb-1 text-sm font-bold uppercase tracking-wide text-cafe-500">Platos más pedidos</h2>
          <p class="mb-4 text-xs text-cafe-400">Calculado a partir de los pedidos de la sesión</p>

          <ul v-if="datos.platosMasPedidos.length" class="space-y-3">
            <li v-for="plato in datos.platosMasPedidos" :key="plato.nombre" class="flex items-center gap-3">
              <span class="w-44 flex-none truncate text-sm font-semibold text-cafe-800">
                {{ plato.nombre }}
              </span>
              <div class="relative h-6 flex-1 overflow-hidden rounded-lg bg-crema-100">
                <div class="h-full rounded-lg bg-gradient-to-r from-durazno-400 to-durazno-500"
                  :style="{ width: Math.round((plato.cantidad / maximoPlatos) * 100) + '%' }"></div>
              </div>
              <span class="w-8 flex-none text-right text-sm font-bold text-cafe-700">
                {{ plato.cantidad }}
              </span>
            </li>
          </ul>
          <p v-else class="py-8 text-center text-sm text-cafe-400">Aún no hay pedidos registrados.</p>
        </section>

        <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-bold uppercase tracking-wide text-cafe-500">Trabajadores</h2>

            <!-- Botón de agregar trabajador ubicado exactamente donde estaba Gestión Activa -->
            <button v-if="esAdmin" @click="abrirModalNuevo"
              class="rounded-lg bg-cafe-700 px-3 py-1 text-xs font-bold text-crema-50 shadow hover:bg-cafe-800 cursor-pointer">
              + Agregar
            </button>
            <span v-else class="text-xs text-cafe-400 font-semibold">Visualización</span>
          </div>

          <div class="space-y-2">
            <div v-for="trabajador in trabajadoresVisibles" :key="trabajador.id"
              class="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-crema-100">
              <div>
                <p class="font-semibold text-cafe-800 text-sm">{{ trabajador.nombre || trabajador.name }}</p>
                <p class="text-xs text-cafe-400">{{ trabajador.correo || trabajador.email }}</p>
              </div>

              <div class="flex items-center gap-2">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cafe-600 bg-durazno-100">
                  {{ trabajador.rol || trabajador.roleName }}
                </span>

                <!-- Botones de administración (Visible solo si es Admin) -->
                <template v-if="esAdmin && trabajador.id !== sesion.usuario?.id">
                  <button @click="abrirEditarTrabajador(trabajador)"
                    class="text-cafe-500 hover:text-cafe-800 p-1 text-xs font-bold cursor-pointer">Editar</button>
                  <button @click="eliminarTrabajador(trabajador.id)"
                    class="text-red-500 hover:text-red-700 p-1 text-xs font-bold cursor-pointer">Eliminar</button>
                </template>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-cafe-900/10 bg-white p-5 shadow-sm lg:col-span-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-sm font-bold uppercase tracking-wide text-cafe-500">Menú</h2>
              <p class="mt-1 text-xs text-cafe-400">Administra productos, precios, categorías y disponibilidad</p>
            </div>
            <button v-if="esAdmin" @click="abrirGestionMenu"
              class="rounded-lg bg-cafe-700 px-3 py-2 text-xs font-bold text-crema-50 shadow hover:bg-cafe-800 cursor-pointer">
              {{ menuGestionAbierto ? 'Ocultar menú' : 'Modificar menú' }}
            </button>
            <span v-else class="text-xs text-cafe-400 font-semibold">Solo administración</span>
          </div>

          <div v-if="menuGestionAbierto" class="mt-5 rounded-xl border border-cafe-900/10 bg-crema-50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-wrap gap-2">
                <button v-for="opcion in opcionesFiltroMenu" :key="opcion.id" type="button"
                  @click="menuFiltroCategoria = opcion.id"
                  class="rounded-full px-3 py-1 text-[11px] font-bold cursor-pointer"
                  :class="menuFiltroCategoria === opcion.id ? 'bg-cafe-700 text-crema-50' : 'bg-white text-cafe-600 hover:bg-cafe-100'">
                  {{ opcion.name }}
                </button>
              </div>
              <button type="button" @click="abrirProductoNuevo"
                class="rounded-lg bg-durazno-500 px-3 py-2 text-xs font-bold text-white shadow hover:bg-durazno-600 cursor-pointer">
                + Agregar producto
              </button>
            </div>

            <div v-if="menuCargando" class="flex items-center justify-center py-10">
              <div class="animate-spin rounded-full h-7 w-7 border-2 border-cafe-200 border-t-cafe-700"></div>
            </div>

            <div v-else-if="menuError" class="rounded-lg bg-red-50 p-4 text-sm text-red-800">
              {{ menuError }}
              <button type="button" @click="cargarMenuAdministracion"
                class="ml-3 rounded bg-red-100 px-2 py-1 text-xs font-bold hover:bg-red-200 cursor-pointer">
                Reintentar
              </button>
            </div>

            <div v-else-if="!productosMenuFiltrados.length" class="py-10 text-center text-sm text-cafe-500">
              No hay productos en esta categoría.
            </div>

            <div v-else class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <article v-for="producto in productosMenuFiltrados" :key="producto.id"
                class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-cafe-900/10">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h3 class="truncate text-sm font-extrabold text-cafe-800">{{ producto.name }}</h3>
                    <p class="mt-1 text-xs font-semibold text-durazno-600">{{ producto.categoryName }}</p>
                  </div>
                  <p class="flex-none text-sm font-extrabold text-cafe-700">{{ formatearPrecio(producto.price) }}</p>
                </div>

                <p class="mt-3 line-clamp-2 text-xs leading-5 text-cafe-500">
                  {{ producto.description || 'Sin descripción' }}
                </p>

                <div class="mt-4 flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-cafe-100 px-2 py-0.5 text-[10px] font-bold uppercase text-cafe-700">
                    {{ tiposProducto.find((tipo) => tipo.code === producto.type)?.name || producto.type }}
                  </span>
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    :class="producto.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                    {{ producto.available ? 'Disponible' : 'No disponible' }}
                  </span>
                </div>

                <div class="mt-4 flex justify-end gap-2 border-t border-cafe-900/10 pt-3">
                  <button type="button" @click="abrirProductoEditar(producto)"
                    class="rounded px-2 py-1 text-xs font-bold text-cafe-600 hover:bg-cafe-100 cursor-pointer">
                    Editar
                  </button>
                  <button type="button" @click="eliminarProducto(producto)"
                    class="rounded px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer">
                    Eliminar
                  </button>
                </div>
              </article>
            </div>
          </div>

          <div v-else class="mt-4 flex items-center justify-between rounded-xl bg-crema-50 px-4 py-3">
            <p class="text-xs text-cafe-500">{{ datos.menu.length }} productos registrados</p>
            <span class="text-xs font-semibold text-cafe-400">La administración está oculta</span>
          </div>
        </section>
      </div>
    </template>

    <!-- VENTANA EMERGENTE (MODAL) SIMPLE -->
    <div v-if="modalAbierto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="text-base font-extrabold text-cafe-800 mb-3">{{ modoTextoModal }}</h3>

        <form class="space-y-3" @submit.prevent="guardarTrabajador">
          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Nombre</label>
            <input v-model="nombreTrabajadorForm" type="text" required maxlength="120"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Correo</label>
            <input v-model="correoTrabajadorForm" type="email" required maxlength="254"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">ID del restaurante</label>
            <input v-model="restauranteTrabajadorForm" type="text" required :disabled="esEdicion"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500 disabled:bg-cafe-100 disabled:text-cafe-500" />
          </div>

          <div v-if="!esEdicion">
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Contraseña inicial</label>
            <input v-model="passwordTrabajadorForm" type="password" required minlength="12" maxlength="128"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Rol</label>
            <select v-model="rolTrabajadorForm" required
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500">
              <option v-for="rol in rolesDisponibles" :key="rol.code" :value="rol.code">
                {{ rol.name }}
              </option>
            </select>
          </div>

          <p v-if="errorFormularioTrabajador" class="text-xs text-red-700">{{ errorFormularioTrabajador }}</p>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="cerrarModal"
              class="rounded-xl bg-cafe-200 px-4 py-2 text-xs font-bold text-cafe-800 hover:bg-cafe-300 cursor-pointer">
              Cancelar
            </button>
            <button type="submit"
              class="rounded-xl bg-cafe-700 px-4 py-2 text-xs font-bold text-crema-50 hover:bg-cafe-800 cursor-pointer">
              {{ esEdicion ? 'Guardar cambios' : 'Crear trabajador' }}
            </button>
          </div>
        </form>
      </div>
    </div>
    <div v-if="menuModalAbierto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 class="text-base font-extrabold text-cafe-800 mb-4">
          {{ esEdicionProducto ? 'Editar producto' : 'Agregar producto' }}
        </h3>

        <form class="space-y-3" @submit.prevent="guardarProducto">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Categoría</label>
              <select v-model="productoForm.categoryId" required
                class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500">
                <option value="" disabled>Selecciona una categoría</option>
                <option v-for="categoria in menuCategorias" :key="categoria.id" :value="categoria.id">
                  {{ categoria.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Tipo</label>
              <select v-model="productoForm.type" required
                class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500">
                <option v-for="tipo in tiposProducto" :key="tipo.code" :value="tipo.code">
                  {{ tipo.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Nombre</label>
            <input v-model="productoForm.name" type="text" required maxlength="120"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500" />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Descripción</label>
            <textarea v-model="productoForm.description" rows="3" maxlength="500"
              class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500"></textarea>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-bold uppercase text-cafe-500 mb-1">Precio</label>
              <input v-model="productoForm.price" type="number" required min="0" step="0.01"
                class="w-full rounded-xl border border-cafe-900/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cafe-500" />
            </div>

            <div class="flex items-end rounded-xl border border-cafe-900/10 bg-crema-50 px-3 py-2">
              <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-cafe-700">
                <input v-model="productoForm.available" type="checkbox" class="h-4 w-4 accent-cafe-700" />
                Disponible para vender
              </label>
            </div>
          </div>

          <p v-if="menuError" class="text-xs text-red-700">{{ menuError }}</p>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="cerrarProductoModal"
              class="rounded-xl bg-cafe-200 px-4 py-2 text-xs font-bold text-cafe-800 hover:bg-cafe-300 cursor-pointer">
              Cancelar
            </button>
            <button type="submit"
              class="rounded-xl bg-cafe-700 px-4 py-2 text-xs font-bold text-crema-50 hover:bg-cafe-800 cursor-pointer">
              {{ esEdicionProducto ? 'Guardar cambios' : 'Crear producto' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
