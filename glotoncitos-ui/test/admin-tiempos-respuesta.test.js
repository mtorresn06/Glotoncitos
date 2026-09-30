import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as api from '../src/services/api.js'
import Dashboard from '../src/views/Dashboard.vue'
import PanelMesas from '../src/views/PanelMesas.vue'
import { useDatosStore } from '../src/stores/datos.js'
import { conLatencia, configurarApiExitosa, crearSesionAdmin } from './helpers/entorno-admin.js'

// Presupuestos de tiempo (ms). Son holgados a proposito: miden la coordinacion de la
// interfaz con la base, no el rendimiento del hardware de quien ejecuta la prueba.
const PRESUPUESTO_CARGA = 400
const PRESUPUESTO_MONTAJE = 900
const PRESUPUESTO_POLLING = 150
const LATENCIA_BASE = 30
const LATENCY_PEDIDOS = 20

function medir() {
  return performance.now()
}

beforeEach(() => {
  crearSesionAdmin()
  configurarApiExitosa()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Tiempos de respuesta a la base de datos (modulo admin)', () => {
  test('la carga del admin consulta en paralelo y no suma las latencias', async () => {
    const latencia = LATENCIA_BASE
    conLatencia('getProductos', latencia, [])
    conLatencia('getMesas', latencia, [])
    conLatencia('getPisos', latencia, [])
    conLatencia('getPedidos', latencia, [])
    conLatencia('getPedidosCerrados', latencia, [])
    conLatencia('getTrabajadores', latencia, [])

    const datos = useDatosStore()
    const inicio = medir()
    await datos.cargarDatos()
    const total = medir() - inicio

    // 5 consultas en paralelo: se espera la mas lenta, no la suma
    expect(total).toBeLessThan(latencia * 3)
    expect(total).toBeLessThan(PRESUPUESTO_CARGA)
  })

  test('el dashboard del administrador queda painted dentro del presupuesto', async () => {
    conLatencia('getProductos', LATENCIA_BASE, [])
    conLatencia('getMesas', LATENCIA_BASE, [])
    conLatencia('getPisos', LATENCIA_BASE, [])
    conLatencia('getPedidos', LATENCIA_BASE, [])
    conLatencia('getPedidosCerrados', LATENCIA_BASE, [])
    conLatencia('getTrabajadores', LATENCIA_BASE, [])
    conLatencia('getMenuCategorias', LATENCIA_BASE, [])
    conLatencia('getMenuProductos', LATENCIA_BASE, [])

    const inicio = medir()
    const wrapper = mount(Dashboard)
    await flushPromises()
    const total = medir() - inicio

    expect(wrapper.text()).toContain('Dashboard')
    expect(total).toBeLessThan(PRESUPUESTO_MONTAJE)
  })

  test('el panel de mesas del administrador queda pintado dentro del presupuesto', async () => {
    conLatencia('getMesas', LATENCIA_BASE, [])
    conLatencia('getPisos', LATENCIA_BASE, [])
    conLatencia('getPedidos', LATENCIA_BASE, [])

    const inicio = medir()
    const wrapper = mount(PanelMesas)
    await flushPromises()
    const total = medir() - inicio

    expect(wrapper.text()).toContain('Panel de Mesas')
    expect(total).toBeLessThan(PRESUPUESTO_MONTAJE)
  })

  test('el refresco periodico del panel responde dentro del presupuesto', async () => {
    const datos = useDatosStore()
    await datos.cargarDatos()

    conLatencia('getMesas', 10, [])
    conLatencia('getPisos', 10, [])

    const inicio = medir()
    await datos.cargarMesas()
    const total = medir() - inicio

    expect(total).toBeLessThan(PRESUPUESTO_POLLING)
  })

  test('el borrado de una mesa recarga los datos dentro del presupuesto', async () => {
    const datos = useDatosStore()
    await datos.cargarDatos()

    api.eliminarMesa.mockResolvedValue({ mesa: { id: 1 } })
    conLatencia('getMesas', LATENCIA_BASE, [])
    conLatencia('getPisos', LATENCIA_BASE, [])
    conLatencia('getPedidos', LATENCIA_BASE, [])
    conLatencia('getProductos', LATENCIA_BASE, [])
    conLatencia('getPedidosCerrados', LATENCIA_BASE, [])
    conLatencia('getTrabajadores', LATENCIA_BASE, [])

    const inicio = medir()
    await datos.eliminarMesa(1)
    const total = medir() - inicio

    expect(api.eliminarMesa).toHaveBeenCalledWith(1)
    expect(total).toBeLessThan(PRESUPUESTO_CARGA)
  })

  test('registra en consola el tiempo medido de cada operacion', async () => {
    conLatencia('getProductos', LATENCIA_BASE, [])
    conLatencia('getMesas', LATENCIA_BASE, [])
    conLatencia('getPisos', LATENCIA_BASE, [])
    conLatencia('getPedidos', LATENCY_PEDIDOS, [])
    conLatencia('getPedidosCerrados', LATENCIA_BASE, [])
    conLatencia('getTrabajadores', LATENCIA_BASE, [])

    const registros = []
    const medirOperacion = async (nombre, operacion) => {
      const inicio = medir()
      await operacion()
      const total = Number((medir() - inicio).toFixed(1))
      registros.push(`${nombre}: ${total} ms`)
      return total
    }

    const datos = useDatosStore()
    await medirOperacion('cargarDatos (admin)', () => datos.cargarDatos())
    await medirOperacion('cargarMesas (polling)', () => datos.cargarMesas())
    await medirOperacion('montar Dashboard', async () => {
      const wrapper = mount(Dashboard)
      await flushPromises()
      wrapper.unmount()
    })
    await medirOperacion('montar PanelMesas', async () => {
      const wrapper = mount(PanelMesas)
      await flushPromises()
      wrapper.unmount()
    })

    console.log(`\nTiempos de respuesta a la base de datos (${LATENCIA_BASE} ms simulados por consulta)`)
    for (const registro of registros) console.log(`  ${registro}`)

    expect(registros).toHaveLength(4)
    expect(registros.every((r) => r.endsWith('ms'))).toBe(true)
  })
})