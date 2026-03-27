import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pods = await prisma.pod.findMany({
    include: {
      memberships: {
        include: {
          user: {
            include: { userRoles: { include: { role: true } } }
          }
        }
      }
    }
  });
  
  console.log('Pods and their managers:');
  pods.forEach(pod => {
    const managers = pod.memberships
      .filter(m => m.user.userRoles.some(ur => ur.role.key === 'podManager'))
      .map(m => m.user.name);
    console.log('  ' + pod.name + ': ' + (managers.length > 0 ? managers.join(', ') : 'No manager assigned'));
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
