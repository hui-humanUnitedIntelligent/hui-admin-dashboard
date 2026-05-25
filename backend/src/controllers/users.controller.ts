import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, role, search, page = '1', limit = '50' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;
  if (role)   where.role = role;
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (parseInt(page) - 1) * parseInt(limit),
      take:  parseInt(limit),
      include: { _count: { select: { transactions: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Ungültige ID' }); return; }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  if (!user) { res.status(404).json({ error: 'User nicht gefunden' }); return; }
  res.json(user);
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const Schema = z.object({ status: z.enum(['active', 'suspended']) });
  const result = Schema.safeParse(req.body);

  if (!result.success) { res.status(400).json({ error: result.error.issues[0].message }); return; }

  const user = await prisma.user.update({
    where: { id },
    data:  { status: result.data.status },
  });

  res.json(user);
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Ungültige ID' }); return; }

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
};
