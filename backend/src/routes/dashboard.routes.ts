import { Router } from 'express';
import { getKPIs, getCharts, getLatestTransactions } from '../controllers/dashboard.controller';

const router = Router();

router.get('/kpis',                getKPIs);
router.get('/charts',              getCharts);
router.get('/latest-transactions', getLatestTransactions);

export default router;
