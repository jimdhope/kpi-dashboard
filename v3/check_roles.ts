import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@kpiquest.local' },
    include: { userRoles: { include: { role: true } } }
  });
  console.log('Admin user with roles:', JSON.stringify(user, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
