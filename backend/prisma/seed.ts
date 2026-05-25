import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starte Seed…');

  // ── Admin anlegen ──────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where:  { email: 'admin@hui-platform.io' },
    update: {},
    create: {
      name:         'Michael Admin',
      email:        'admin@hui-platform.io',
      passwordHash: hash,
      role:         'super_admin',
    },
  });
  console.log('✓ Admin angelegt');

  // ── Beispiel-User ──────────────────────────────────────────────────────
  const usersData = [
    { name: 'Sara Müller',  email: 'sara@example.de',   role: 'Talent',    status: 'active',    city: 'Berlin'    },
    { name: 'Luca Bianchi', email: 'luca@example.it',   role: 'User',      status: 'active',    city: 'Wien'      },
    { name: 'Aisha Kofi',   email: 'aisha@example.com', role: 'Talent',    status: 'active',    city: 'Köln'      },
    { name: 'Felix Schmid', email: 'felix@example.de',  role: 'User',      status: 'suspended', city: 'München'   },
    { name: 'Elena Rossi',  email: 'elena@example.it',  role: 'Talent',    status: 'active',    city: 'Hamburg'   },
    { name: 'Jonas Weber',  email: 'jonas@example.de',  role: 'Moderator', status: 'active',    city: 'Frankfurt' },
  ];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.upsert({ where: { email: u.email }, update: {}, create: u })
    )
  );
  console.log(`✓ ${users.length} User angelegt`);

  // ── Beispiel-Transaktionen ─────────────────────────────────────────────
  const txTypes  = ['Buchung', 'Auszahlung', 'Einzahlung', 'Impact-Beitrag'];
  const txStatus = ['completed', 'completed', 'pending', 'failed'];

  for (let i = 0; i < 20; i++) {
    const user = users[i % users.length];
    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: parseFloat((Math.random() * 200 + 20).toFixed(2)),
        type:   txTypes[i % txTypes.length],
        status: txStatus[i % txStatus.length],
      },
    });
  }
  console.log('✓ 20 Transaktionen angelegt');

  // ── Impact Pool ────────────────────────────────────────────────────────
  const pool = await prisma.impactPool.findFirst();
  if (!pool) {
    await prisma.impactPool.create({ data: { balance: 9247 } });
    console.log('✓ Impact Pool angelegt');
  }

  console.log('✅ Seed abgeschlossen');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
