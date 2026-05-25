// ── Controller ────────────────────────────────────────────────────────────
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

const LoginSchema = z.object({
  email:    z.string().email('Ungültige E-Mail'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { email, password } = result.data;

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    // Gleiche Fehlermeldung um User-Enumeration zu verhindern
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    return;
  }

  const secret = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    admin: {
      id:    admin.id,
      name:  admin.name,
      email: admin.email,
      role:  admin.role,
    },
  });
};

export const logout = (_req: AuthRequest, res: Response): void => {
  // JWT ist stateless — Client löscht Token lokal
  res.json({ message: 'Erfolgreich abgemeldet' });
};

export const me = (req: AuthRequest, res: Response): void => {
  res.json({ admin: req.admin });
};
