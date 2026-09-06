import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// TODO Sprint 3 (RF-15 a RF-19): consulta de cuenta, registro de pago,
// cierre de cuenta y reportes de ventas por periodo.
router.get('/', requireAuth, requireRole('ADMINISTRADOR', 'CAJERO'), (req, res) => {
  res.json({ mensaje: 'Endpoint de ventas pendiente de implementar (Sprint 3)' });
});

export default router;
