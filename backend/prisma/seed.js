const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);
  const SEED_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@taskflow.local';
  const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);

  const existing = await prisma.user.findUnique({
    where: { email: SEED_EMAIL },
  });

  if (existing) {
    console.log(`Seed admin already exists: ${SEED_EMAIL}`);
    return;
  }

  await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      passwordHash,
      fullName: 'Admin User',
      role: 'Admin',
      department: 'Engineering',
    },
  });

  console.log(`Seed admin created: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());