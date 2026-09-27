export function formatearPrecio(valor) {
  const n = Number(valor) || 0
  return 'S/ ' + n.toFixed(2)
}

function aMilISegundos(valor) {
  if (valor === null || valor === undefined || valor === '') return NaN
  if (valor instanceof Date) return valor.getTime()
  if (typeof valor === 'number') return valor
  const fecha = new Date(valor)
  return fecha.getTime()
}

export function formatearTiempo(desde, ahora = Date.now()) {
  const inicio = aMilISegundos(desde)
  const fin = aMilISegundos(ahora)
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return '-'

  const seg = Math.max(0, Math.floor((fin - inicio) / 1000))
  if (seg < 60) return `${seg} s`

  const min = Math.floor(seg / 60)
  if (min < 60) return `${min} min ${seg % 60} s`

  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
}