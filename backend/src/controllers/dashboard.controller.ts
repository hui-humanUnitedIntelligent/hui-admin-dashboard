import { Response } from 'express';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getKPIs = async (_req: AuthRequest, res: Response): Promise<void> => {
  const [totalUsers, activeTalents, impactPool, monthlyRevenue] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'Talent', status: 'active' } }),
      prisma.impactPool.findFirst({ orderBy: { lastUpdate: 'desc' } }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'completed',
          createdAt: {
            gte: new Date(new Date().setDate(1)), // Erster des Monats
          },
        },
      }),
    ]);

  res.json({
    totalUsers,
    activeTalents,
    impactPoolBalance: impactPool?.balance ?? 0,
    monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
  });
};

export const getCharts = async (_req: AuthRequest, res: Response): Promise<void> => {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('de-DE', { month: 'short' }) };
  });

  const userGrowth = await Promise.all(
    months.map(async ({ year, month, label }) => {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      return { label, count };
    })
  );

  const txLast7 = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const d     = new Date();
      d.setDate(d.getDate() - (6 - i));
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end   = new Date(d.setHours(23, 59, 59, 999));
      const count = await prisma.transaction.count({ where: { createdAt: { gte: start, lte: end } } });
      return { label: start.toLocaleString('de-DE', { weekday: 'short' }), count };
    })
  );

  res.json({ userGrowth, txLast7 });
};

export const getLatestTransactions = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  const transactions = await prisma.transaction.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true } } },
  });

  res.json(transactions);
};
