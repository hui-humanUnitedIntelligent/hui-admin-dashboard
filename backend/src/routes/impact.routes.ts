import { Router } from 'express';
import { getImpactBalance, getImpactHistory } from '../controllers/impact.controller';
const router = Router();
router.get('/balance', getImpactBalance);
router.get('/history', getImpactHistory);
export default router;
