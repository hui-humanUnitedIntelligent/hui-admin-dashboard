import 'dotenv/config';
import app from './app';
import { prisma } from './db/prisma';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  try {
    // Datenbankverbindung prüfen
    await prisma.$connect();
    console.log('✓ Datenbankverbindung hergestellt');

    app.listen(PORT, () => {
      console.log(`✓ HUI Admin Backend läuft auf Port ${PORT}`);
      console.log(`  Umgebung: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Health:   http://localhost:${PORT}/health`);
      console.log(`  API:      http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('✗ Startfehler:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
