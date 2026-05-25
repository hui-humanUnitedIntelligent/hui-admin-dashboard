import { Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const Schema = z.object({
    name:  z.string().min(2, 'Name zu kurz').optional(),
    email: z.string().email('Ungültige E-Mail').optional(),
  });
  const result = Schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const admin = await prisma.admin.update({
    where:  { id: req.admin!.id },
    data:   result.data,
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(admin);
};

export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const Schema = z.object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    newPassword:     z.string().min(8, 'Neues Passwort: min. 8 Zeichen'),
  });
  const result = Schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });
  if (!admin) { res.status(404).json({ error: 'Admin nicht gefunden' }); return; }

  const valid = await bcrypt.compare(result.data.currentPassword, admin.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Aktuelles Passwort falsch' }); return; }

  const hash = await bcrypt.hash(result.data.newPassword, 10);
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: hash } });

  res.json({ message: 'Passwort erfolgreich geändert' });
};
