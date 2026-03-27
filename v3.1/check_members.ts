import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.podMembership.findMany({
    include: {
      pod: true,
      user: { select: { name: true, email: true } }
    },
    take: 15
  });
  
  console.log('Pod memberships:');
  memberships.forEach(m => {
    console.log(`  ${m.user?.name} -> ${m.pod.name} (${m.pod.id})`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
