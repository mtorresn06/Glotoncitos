import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// TODO Sprint 2/3 (RF-08 a RF-14): registrar pedido, agregar/cancelar productos,
// notas para cocina, consulta y actualización del estado de preparación.
// Dejar aquí las rutas placeholder evita que el resto del equipo se bloquee
// mientras se implementa el controlador completo.
router.get('/', requireAuth, (req, res) => {
  res.json({ mensaje: 'Endpoint de pedidos pendiente de implementar (Sprint 2/3)' });
});

export default router;
