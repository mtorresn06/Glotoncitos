import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { listarMesas, actualizarEstadoMesa, crearMesa } from '../controllers/mesas.controller.js';

const router = Router();

// Cualquier usuario autenticado puede consultar el mapa de mesas
router.get('/', requireAuth, listarMesas);

// Mesero (o administrador) puede cambiar el estado de una mesa
router.patch('/:id/estado', requireAuth, requireRole('MESERO', 'ADMINISTRADOR'), actualizarEstadoMesa);

// Solo el administrador configura mesas nuevas
router.post('/', requireAuth, requireRole('ADMINISTRADOR'), crearMesa);

export default router;
