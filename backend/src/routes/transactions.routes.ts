// transactions.routes.ts
import { Router } from 'express';
import { getTransactions, getTransactionById } from '../controllers/transactions.controller';
const router = Router();
router.get('/',    getTransactions);
router.get('/:id', getTransactionById);
export default router;
