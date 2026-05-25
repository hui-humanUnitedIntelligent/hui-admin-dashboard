import cors from 'cors';

const ALLOWED_ORIGINS = [
  process.env.ADMIN_DOMAIN || 'https://admin.hui-platform.io',
  process.env.CORS_ORIGIN  || 'https://admin.hui-platform.io',
  'http://localhost:3000',
  'http://localhost:3001',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Server-zu-Server-Anfragen (kein Origin-Header) erlauben
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blockiert: ${origin}`);
    callback(new Error(`CORS: Origin nicht erlaubt: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
