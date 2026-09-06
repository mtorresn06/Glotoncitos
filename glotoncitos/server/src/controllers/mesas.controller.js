import { prisma } from '../config/db.js';

// RF-05: consultar el mapa de mesas junto con su estado actual
export async function listarMesas(req, res) {
  const mesas = await prisma.mesa.findMany({ orderBy: [{ piso: 'asc' }, { numero: 'asc' }] });
  res.json(mesas);
}

// RF-06: actualizar el estado de una mesa entre libre y ocupada
// RF-07: al ocupar una mesa se registra la hora, para mostrar el tiempo transcurrido
export async function actualizarEstadoMesa(req, res) {
  const { id } = req.params;
  const { estado } = req.body; // "LIBRE" | "OCUPADA"

  if (!['LIBRE', 'OCUPADA'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  const mesa = await prisma.mesa.update({
    where: { id: Number(id) },
    data: {
      estado,
      ocupadaDesde: estado === 'OCUPADA' ? new Date() : null,
    },
  });

  res.json(mesa);
}

// RF-04: el administrador configura las mesas disponibles
export async function crearMesa(req, res) {
  const { numero, piso } = req.body;
  const mesa = await prisma.mesa.create({ data: { numero, piso: piso ?? 1 } });
  res.status(201).json(mesa);
}
