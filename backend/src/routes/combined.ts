// ── Transactions Routes ────────────────────────────────────────────────────
import { Router } from 'express';
import { getTransactions, getTransactionById } from '../controllers/transactions.controller';

const txRouter = Router();
txRouter.get('/',    getTransactions);
txRouter.get('/:id', getTransactionById);
export const transactionsRoutes = txRouter;


// ── Impact Pool Controller ─────────────────────────────────────────────────
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getImpactBalance = async (_req: AuthRequest, res: Response): Promise<void> => {
  const pool = await prisma.impactPool.findFirst({ orderBy: { lastUpdate: 'desc' } });
  res.json({ balance: pool?.balance ?? 0, lastUpdate: pool?.lastUpdate });
};

export const getImpactHistory = async (_req: AuthRequest, res: Response): Promise<void> => {
  const history = await prisma.impactTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(history);
};

const impactRouter = Router();
impactRouter.get('/balance', getImpactBalance);
impactRouter.get('/history', getImpactHistory);
export const impactRoutes = impactRouter;


// ── Settings Controller ────────────────────────────────────────────────────
import bcrypt from 'bcrypt';
import { z } from 'zod';

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const Schema = z.object({
    name:  z.string().min(2).optional(),
    email: z.string().email().optional(),
  });
  const result = Schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

  const admin = await prisma.admin.update({
    where: { id: req.admin!.id },
    data:  result.data,
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(admin);
};

export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const Schema = z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8, 'Min. 8 Zeichen'),
  });
  const result = Schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

  const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
  if (!admin) { res.status(404).json({ error: 'Admin nicht gefunden' }); return; }

  const valid = await bcrypt.compare(result.data.currentPassword, admin.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Aktuelles Passwort falsch' }); return; }

  const hash = await bcrypt.hash(result.data.newPassword, 10);
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: hash } });
  res.json({ message: 'Passwort erfolgreich geändert' });
};

const settingsRouter = Router();
settingsRouter.patch('/profile',  updateProfile);
settingsRouter.patch('/password', updatePassword);
export const settingsRoutes = settingsRouter;
