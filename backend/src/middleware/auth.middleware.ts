import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  admin?: {
    id: number;
    email: string;
    role: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Nicht authentifiziert: Kein Token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET nicht gesetzt!');
    res.status(500).json({ error: 'Server-Konfigurationsfehler' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as {
      id: number;
      email: string;
      role: string;
    };
    req.admin = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token abgelaufen' });
    } else {
      res.status(401).json({ error: 'Token ungültig' });
    }
  }
};
