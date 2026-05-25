// ── Controller ─────────────────────────────────────────────────────────────
import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, period, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;
  if (period) {
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    where.createdAt = { gte: cutoff };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({ transactions, total });
};

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!tx) { res.status(404).json({ error: 'Transaktion nicht gefunden' }); return; }
  res.json(tx);
};
