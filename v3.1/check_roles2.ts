import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check all roles
  const roles = await prisma.role.findMany();
  console.log('Available roles:');
  roles.forEach(r => console.log(`  ${r.key}: ${r.name}`));
  
  // Check users with podManager role
  const podManagers = await prisma.userRole.findMany({
    where: { role: { key: 'podManager' } },
    include: { 
      user: { select: { id: true, name: true, email: true, podId: true } },
      role: true
    }
  });
  
  console.log('\nUsers with podManager role:');
  podManagers.forEach(pm => {
    console.log(`  ${pm.user.name} (${pm.user.email}) - podId: ${pm.user.podId}`);
  });
  
  // Check all users
  const users = await prisma.user.findMany({
    take: 5,
    include: { userRoles: { include: { role: true } } }
  });
  
  console.log('\nSample users with roles:');
  users.forEach(u => {
    const roleKeys = u.userRoles.map(ur => ur.role.key);
    console.log(`  ${u.name}: ${roleKeys.join(', ')}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
