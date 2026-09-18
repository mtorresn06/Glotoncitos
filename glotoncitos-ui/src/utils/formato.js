export function formatearPrecio(valor) {
  const n = Number(valor) || 0
  return 'S/ ' + n.toFixed(2)
}

export function formatearTiempo(desde, ahora = Date.now()) {
  const seg = Math.max(0, Math.floor((ahora - desde) / 1000))
  if (seg < 60) return `${seg} s`
  const min = Math.floor(seg / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
}