import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as api from '../src/services/api.js'
import Dashboard from '../src/views/Dashboard.vue'
import {
  CATEGORIAS,
  MESAS,
  PEDIDOS,
  PEDIDOS_CERRADOS,
  PRODUCTOS_MENU,
  TRABAJADORES,
  configurarApiExitosa,
  crearSesionAdmin,
  rechazarLlamada,
} from './helpers/entorno-admin.js'

beforeEach(() => {
  crearSesionAdmin()
  configurarApiExitosa()
  confirmarRespuesta(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function confirmarRespuesta(acepta) {
  vi.stubGlobal('confirm', vi.fn(() => acepta))
  return globalThis.confirm
}

async function montarDashboard() {
  const wrapper = mount(Dashboard)
  await flushPromises()
  return wrapper
}

async function abrirMenu(wrapper) {
  const boton = wrapper.findAll('button').find((b) => b.text() === 'Mostar menú')
  expect(boton, 'no se encontro el boton Mostrar menu').toBeTruthy()
  await boton.trigger('click')
  await flushPromises()
  return boton
}

function articuloProducto(wrapper, nombre) {
  return wrapper.findAll('article').find((a) => a.text().includes(nombre))
}

function formularioProducto(wrapper) {
  const modal = wrapper.findAll('div').find((d) => {
    const titulo = d.find('h3')
    return titulo.exists() && titulo.text().includes('producto')
  })
  expect(modal, 'no se encontro el modal de producto').toBeTruthy()
  return modal.find('form')
}

async function abrirNuevoProducto(wrapper) {
  await abrirMenu(wrapper)
  await wrapper.findAll('button').find((b) => b.text() === '+ Agregar producto').trigger('click')
  await flushPromises()
  return formularioProducto(wrapper)
}

describe('Dashboard del administrador', () => {
  test('pide los datos administrativos: trabajadores y pedidos cerrados', async () => {
    await montarDashboard()

    expect(api.getTrabajadores).toHaveBeenCalled()
    expect(api.getPedidosCerrados).toHaveBeenCalled()
    expect(api.getPedidosListos).not.toHaveBeenCalled()
  })

  test('muestra las metricas del negocio con los datos del store', async () => {
    const wrapper = await montarDashboard()
    const texto = wrapper.text()

    expect(texto).toContain('Ventas del día')
    expect(texto).toContain('Mesas ocupadas')
    expect(texto).toContain('Mesas libres')
    expect(texto).toContain(`Suma de las cuentas cerradas`)
    expect(texto).toContain(String(MESAS.length))
    expect(texto).toContain(String(PEDIDOS.length + PEDIDOS_CERRADOS.length))
    expect(texto).toContain('Ceviche')
  })

  test('oculta al administrador de la lista de trabajadores', async () => {
    const wrapper = await montarDashboard()
    const texto = wrapper.text()

    expect(texto).not.toContain('Ana Admin')
    expect(texto).not.toContain(TRABAJADORES[0].correo)
    expect(texto).toContain('Luis Mesero')
  })

  test('carga el menu al montar y lo muestra al pulsar Mostrar menu', async () => {
    const wrapper = await montarDashboard()

    expect(api.getMenuCategorias).toHaveBeenCalled()
    expect(api.getMenuProductos).toHaveBeenCalled()
    expect(wrapper.text()).toContain('La administración está oculta')
    expect(wrapper.text()).toContain('Mostar menú')

    await abrirMenu(wrapper)

    expect(wrapper.text()).toContain('Ceviche')
    expect(wrapper.text()).toContain('Ocultar menú')
    expect(wrapper.text()).toContain(String(PRODUCTOS_MENU.length))
  })

  test('filtra los productos del menu por categoria', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const antes = wrapper.findAll('article').map((a) => a.text())
    expect(antes.some((t) => t.includes('Ceviche'))).toBe(true)
    expect(antes.some((t) => t.includes('Lomo saltado'))).toBe(true)

    await wrapper.findAll('button').find((b) => b.text() === CATEGORIAS[1].nombre).trigger('click')
    await flushPromises()

    const despues = wrapper.findAll('article').map((a) => a.text())
    expect(despues.some((t) => t.includes('Lomo saltado'))).toBe(true)
    expect(despues.some((t) => t.includes('Ceviche'))).toBe(false)
  })

  test('exige categoria, nombre y precio valido antes de crear un producto', async () => {
    const wrapper = await montarDashboard()
    const formulario = await abrirNuevoProducto(wrapper)

    await formulario.trigger('submit')
    await flushPromises()

    expect(api.crearProductoMenu).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Completa la categoría, el nombre y un precio válido')
  })

  test('rechaza un precio negativo antes de llamar a la api', async () => {
    const wrapper = await montarDashboard()
    const formulario = await abrirNuevoProducto(wrapper)

    await formulario.findAll('select')[0].setValue(CATEGORIAS[0].id)
    const [inputNombre, , inputPrecio] = formulario.findAll('input, textarea')
    await inputNombre.setValue('Causa limeña')
    await inputPrecio.setValue('-5')
    await formulario.trigger('submit')
    await flushPromises()

    expect(api.crearProductoMenu).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Completa la categoría, el nombre y un precio válido')
  })

  test('crea un producto con el payload que espera la api', async () => {
    const wrapper = await montarDashboard()
    const formulario = await abrirNuevoProducto(wrapper)

    await formulario.findAll('select')[0].setValue(CATEGORIAS[0].id)
    const [inputNombre, textareaDescripcion, inputPrecio] = formulario.findAll('input, textarea')
    await inputNombre.setValue('  Sudado de pollo  ')
    await textareaDescripcion.setValue('  Sin ají  ')
    await inputPrecio.setValue('42.50')
    await formulario.trigger('submit')
    await flushPromises()

    expect(api.crearProductoMenu).toHaveBeenCalledWith({
      categoryId: CATEGORIAS[0].id,
      name: 'Sudado de pollo',
      description: 'Sin ají',
      price: 42.5,
      type: 'plato',
      available: true,
    })
  })

  test('precarga el formulario al editar y envia la actualizacion con el id', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const articulo = articuloProducto(wrapper, 'Ceviche')
    expect(articulo, 'no se encontro el producto Ceviche').toBeTruthy()
    await articulo.findAll('button').find((b) => b.text() === 'Editar').trigger('click')
    await flushPromises()

    const formulario = formularioProducto(wrapper)
    expect(wrapper.text()).toContain('Editar producto')
    const [inputNombre, , inputPrecio] = formulario.findAll('input, textarea')
    expect(inputNombre.element.value).toBe('Ceviche')

    await inputPrecio.setValue('33')
    await formulario.trigger('submit')
    await flushPromises()

    expect(api.actualizarProductoMenu).toHaveBeenCalledWith(
      PRODUCTOS_MENU[0].id,
      expect.objectContaining({ name: 'Ceviche', price: 33 }),
    )
  })

  test('no elimina el producto si el administrador cancela la confirmacion', async () => {
    confirmarRespuesta(false)
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const articulo = articuloProducto(wrapper, 'Ceviche')
    await articulo.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(globalThis.confirm).toHaveBeenCalled()
    expect(api.eliminarProductoMenu).not.toHaveBeenCalled()
  })

  test('elimina el producto cuando el administrador confirma', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const articulo = articuloProducto(wrapper, 'Ceviche')
    await articulo.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(api.eliminarProductoMenu).toHaveBeenCalledWith(PRODUCTOS_MENU[0].id)
  })

  test('explica por que no se puede eliminar un producto con pedidos y conserva la lista', async () => {
    rechazarLlamada('eliminarProductoMenu', 'El producto tiene historial de pedidos y no se puede eliminar')
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const articulo = articuloProducto(wrapper, 'Ceviche')
    await articulo.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(api.eliminarProductoMenu).toHaveBeenCalled()
    expect(wrapper.text()).toContain('El producto tiene historial de pedidos y no se puede eliminar')
    // el aviso no debe reemplazar el listado de productos
    expect(wrapper.text()).toContain('Ceviche')
  })

  test('muestra el mensaje de error cuando la api rechaza el guardado', async () => {
    rechazarLlamada('crearProductoMenu', 'El precio no coincide con el historial')
    const wrapper = await montarDashboard()
    const formulario = await abrirNuevoProducto(wrapper)

    await formulario.findAll('select')[0].setValue(CATEGORIAS[0].id)
    const [inputNombre, , inputPrecio] = formulario.findAll('input, textarea')
    await inputNombre.setValue('Causa复查')
    await inputPrecio.setValue('18')
    await formulario.trigger('submit')
    await flushPromises()

    expect(api.crearProductoMenu).toHaveBeenCalled()
    expect(wrapper.text()).toContain('El precio no coincide con el historial')
  })

  test('oculta las acciones de administrador cuando el rol no es admin', async () => {
    const sesion = crearSesionAdmin()
    sesion.rolId = 'mesero'
    const wrapper = await montarDashboard()

    const texto = wrapper.text()
    expect(texto).not.toContain('Mostar menú')
    expect(texto).toContain('Solo administración')
    expect(texto).not.toContain('+ Agregar')
    expect(api.getTrabajadores).not.toHaveBeenCalled()
    expect(api.getPedidosCerrados).not.toHaveBeenCalled()
  })
})

describe('Categorías del menú administradas por el administrador', () => {
  test('exige un nombre antes de llamar a la api', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.crearCategoriaMenu).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe el nombre de la categoría')
  })

  test('crea la categoria con el nombre que escribe el administrador', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    await wrapper.find('#categoria-nueva').setValue('Parrilladas')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.crearCategoriaMenu).toHaveBeenCalledWith('Parrilladas')
  })

  test('renombra una categoria existente con su id', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const item = wrapper.findAll('li').find((li) => li.text().includes('Entradas'))
    await item.findAll('button').find((b) => b.text() === 'Renombrar').trigger('click')
    await wrapper.find('#categoria-nueva').setValue('Entradas frías')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.actualizarCategoriaMenu).toHaveBeenCalledWith(CATEGORIAS[0].id, 'Entradas frías')
    expect(api.crearCategoriaMenu).not.toHaveBeenCalled()
  })

  test('elimina una categoria cuando el administrador confirma', async () => {
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const item = wrapper.findAll('li').find((li) => li.text().includes('Entradas'))
    await item.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(api.eliminarCategoriaMenu).toHaveBeenCalledWith(CATEGORIAS[0].id)
  })

  test('no elimina la categoria si el administrador cancela la confirmacion', async () => {
    confirmarRespuesta(false)
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const item = wrapper.findAll('li').find((li) => li.text().includes('Entradas'))
    await item.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(globalThis.confirm).toHaveBeenCalled()
    expect(api.eliminarCategoriaMenu).not.toHaveBeenCalled()
  })

  test('explica cuando una categoria tiene productos y no se puede eliminar', async () => {
    rechazarLlamada('eliminarCategoriaMenu', 'La categoría tiene el producto "Ceviche"; muévelo a otra categoría antes de eliminarla')
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    const item = wrapper.findAll('li').find((li) => li.text().includes('Entradas'))
    await item.findAll('button').find((b) => b.text() === 'Eliminar').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('La categoría tiene el producto "Ceviche"')
    expect(wrapper.text()).toContain('Entradas')
  })

  test('invita a crear la primera categoria cuando el menu esta vacio', async () => {
    configurarApiExitosa({ getMenuCategorias: [], getMenuProductos: [] })
    const wrapper = await montarDashboard()
    await abrirMenu(wrapper)

    expect(wrapper.text()).toContain('Todavía no hay categorías')
    expect(wrapper.text()).toContain('Crea la primera para poder agregar productos')
  })
})
