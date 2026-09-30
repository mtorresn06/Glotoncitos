import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as api from '../src/services/api.js'
import PanelMesas from '../src/views/PanelMesas.vue'
import {
  MESAS,
  PISOS,
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

async function montarPanel() {
  const wrapper = mount(PanelMesas)
  await flushPromises()
  return wrapper
}

function tarjeta(wrapper, nombre) {
  return wrapper.findAll('button').find((b) => b.text().includes(`Piso`) && b.text().startsWith(nombre))
}

function botonesPiso(wrapper) {
  return wrapper.findAll('div').filter((d) => d.findAll('button').length === 2)
}

function botonEliminarPiso(wrapper, numero) {
  const bloque = botonesPiso(wrapper).find((d) => d.text().includes(`Piso ${numero}`))
  expect(bloque, `no se encontro la pestana del piso ${numero}`).toBeTruthy()
  return bloque.findAll('button')[1]
}

async function abrirMesa(wrapper, nombre) {
  const card = tarjeta(wrapper, nombre)
  expect(card, `no se encontro la mesa ${nombre}`).toBeTruthy()
  await card.trigger('click')
  await flushPromises()
}

describe('Panel de mesas del administrador', () => {
  test('carga el panel sin pedir los pedidos listos del mesero', async () => {
    const wrapper = await montarPanel()

    expect(api.getMesas).toHaveBeenCalled()
    expect(api.getPisos).toHaveBeenCalled()
    expect(api.getPedidosListos).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Panel de Mesas')
  })

  test('muestra los controles de creacion solo al administrador', async () => {
    const wrapper = await montarPanel()
    const texto = wrapper.text()

    expect(texto).toContain('+ Crear piso')
    expect(texto).toContain('+ Crear mesa')
    expect(texto).toContain('Tocar para editar el número')
  })

  test('oculta el panel de aceptacion de ordenes lista al administrador', async () => {
    const wrapper = await montarPanel()

    expect(wrapper.text()).not.toContain('esperando aceptación')
  })

  test('al tocar una mesa abre el modal de edicion y precarga el numero', async () => {
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '1')

    expect(wrapper.text()).toContain('Mesa 1')
    expect(wrapper.text()).toContain('Piso 1 · Pedido en solo lectura')
    expect(wrapper.find('#numero-mesa').element.value).toBe('1')
    expect(wrapper.text()).toContain('Eliminar mesa')
  })

  test('renombra la mesa con el numero que escribe el administrador', async () => {
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '1')

    await wrapper.find('#numero-mesa').setValue('7')
    await wrapper.findAll('form').find((f) => f.text().includes('Guardar número')).trigger('submit')
    await flushPromises()

    expect(api.actualizarMesa).toHaveBeenCalledWith('mesa-1', { numero: 7 })
  })

  test('no borra la mesa si el administrador cancela la confirmacion', async () => {
    confirmarRespuesta(false)
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '1')

    const boton = wrapper.findAll('button').find((b) => b.text() === 'Eliminar mesa')
    await boton.trigger('click')
    await flushPromises()

    expect(globalThis.confirm).toHaveBeenCalled()
    expect(api.eliminarMesa).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Mesa 1')
  })

  test('borra la mesa cuando el administrador confirma', async () => {
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '1')

    await wrapper.findAll('button').find((b) => b.text() === 'Eliminar mesa').trigger('click')
    await flushPromises()

    expect(api.eliminarMesa).toHaveBeenCalledWith('mesa-1')
    expect(wrapper.text()).not.toContain('Pedido en solo lectura')
  })

  test('muestra el aviso cuando la mesa tiene una cuenta abierta', async () => {
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '2')

    expect(wrapper.text()).toContain('La mesa tiene una cuenta abierta: primero cobra o cancela la mesa.')
  })

  test('muestra el error del backend y conserva el modal si no se puede eliminar', async () => {
    rechazarLlamada('eliminarMesa', 'La mesa tiene historial de pedidos y no se puede eliminar')
    const wrapper = await montarPanel()
    await abrirMesa(wrapper, '1')

    await wrapper.findAll('button').find((b) => b.text() === 'Eliminar mesa').trigger('click')
    await flushPromises()

    expect(api.eliminarMesa).toHaveBeenCalledWith('mesa-1')
    expect(wrapper.text()).toContain('La mesa tiene historial de pedidos y no se puede eliminar')
    expect(wrapper.text()).toContain('Mesa 1')
  })

  test('deshabilita borrar un piso que todavia tiene mesas', async () => {
    const wrapper = await montarPanel()

    const boton = botonEliminarPiso(wrapper, 1)
    expect(boton.attributes('disabled')).toBeDefined()
    expect(boton.attributes('title')).toBe('El piso tiene mesas')

    await boton.trigger('click')
    await flushPromises()

    expect(api.eliminarPiso).not.toHaveBeenCalled()
  })

  test('crea una mesa en el piso que el administrador tiene abierto', async () => {
    const wrapper = await montarPanel()
    await wrapper.findAll('button').find((b) => b.text() === '+ Crear mesa').trigger('click')
    await flushPromises()

    const formulario = wrapper.findAll('form').find((f) => f.text().includes('Crear mesa'))
    await formulario.find('#nueva-mesa').setValue('12')
    await formulario.find('#capacidad-mesa').setValue('6')
    await formulario.trigger('submit')
    await flushPromises()

    expect(api.crearMesa).toHaveBeenCalledWith({ numero: 12, capacidad: 6, idPiso: 'piso-1' })
  })

  test('borra un piso vacio y deja seleccionado el primer piso restante', async () => {
    const wrapper = await montarPanel()
    const boton = botonEliminarPiso(wrapper, 3)

    expect(boton.attributes('disabled')).toBeUndefined()
    expect(boton.attributes('title')).toBe('Eliminar piso')

    await boton.trigger('click')
    await flushPromises()

    expect(api.eliminarPiso).toHaveBeenCalledWith('piso-3')
  })

  test('no borra el piso si el administrador no confirma', async () => {
    confirmarRespuesta(false)
    const wrapper = await montarPanel()

    await botonEliminarPiso(wrapper, 3).trigger('click')
    await flushPromises()

    expect(api.eliminarPiso).not.toHaveBeenCalled()
  })

  test('oculta los controles de administrador cuando el rol es mesero', async () => {
    const sesion = crearSesionAdmin()
    sesion.rolId = 'mesero'
    const wrapper = await montarPanel()
    const texto = wrapper.text()

    expect(texto).not.toContain('+ Crear piso')
    expect(texto).not.toContain('+ Crear mesa')
    expect(texto).toContain('Tocar para tomar pedido')
    expect(api.getPedidosListos).toHaveBeenCalled()
  })
})
