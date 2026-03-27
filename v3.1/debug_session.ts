import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@kpiquest.local' },
    include: { 
      userRoles: { include: { role: true } }
    }
  });
  
  // Simulate what mapUser does
  const roles = user?.userRoles.map((entry) => entry.role.key);
  console.log('Roles from database:', roles);
  console.log('User has admin role:', roles?.includes('admin'));
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
