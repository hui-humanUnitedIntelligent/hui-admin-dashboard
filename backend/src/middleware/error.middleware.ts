import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Interner Serverfehler',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  });
}
