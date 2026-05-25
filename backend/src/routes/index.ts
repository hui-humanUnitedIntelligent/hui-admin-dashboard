import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import authRoutes        from './auth.routes';
import dashboardRoutes   from './dashboard.routes';
import usersRoutes       from './users.routes';
import transactionsRoutes from './transactions.routes';
import impactRoutes      from './impact.routes';
import settingsRoutes    from './settings.routes';

const router = Router();

// ── Öffentlich: nur Login ──────────────────────────────────────────────────
router.use('/auth', authRoutes);

// ── Geschützt: JWT erforderlich ────────────────────────────────────────────
router.use('/dashboard',     authMiddleware, dashboardRoutes);
router.use('/users',         authMiddleware, usersRoutes);
router.use('/transactions',  authMiddleware, transactionsRoutes);
router.use('/impact-pool',   authMiddleware, impactRoutes);
router.use('/settings',      authMiddleware, settingsRoutes);

export default router;
