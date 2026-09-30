import { vi } from 'vitest'

// Toda la UI se apoya en services/api.js. Aqui se sustituye ese modulo por dobles
// para poder probar los componentes sin backend ni base de datos.
vi.mock('../src/services/api.js', () => {
  const fn = () => vi.fn()
  return {
    login: fn(),
    getProductos: fn(),
    getMesas: fn(),
    getPisos: fn(),
    getPedidos: fn(),
    getPedidosListos: fn(),
    getPedidosCerrados: fn(),
    getTrabajadores: fn(),
    getPagos: fn(),
    getPedidosCocina: fn(),
    crearPiso: fn(),
    crearMesa: fn(),
    eliminarMesa: fn(),
    eliminarPiso: fn(),
    actualizarMesa: fn(),
    cambiarEstadoMesa: fn(),
    agregarProductosPedido: fn(),
    cancelarMesa: fn(),
    cambiarMesa: fn(),
    marcarProductoListo: fn(),
    confirmarPedidoListo: fn(),
    crearPedido: fn(),
    avanzarProducto: fn(),
    cancelarProducto: fn(),
    actualizarProducto: fn(),
    registrarPago: fn(),
    revertirPago: fn(),
    crearTrabajador: fn(),
    actualizarTrabajador: fn(),
    eliminarTrabajador: fn(),
    getMenuCategorias: fn(),
    getMenuProductos: fn(),
    crearCategoriaMenu: fn(),
    actualizarCategoriaMenu: fn(),
    eliminarCategoriaMenu: fn(),
    crearProductoMenu: fn(),
    actualizarProductoMenu: fn(),
    eliminarProductoMenu: fn(),
  }
})
