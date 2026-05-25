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
