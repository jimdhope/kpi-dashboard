import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check users and their pod memberships
  const users = await prisma.user.findMany({
    take: 10,
    include: {
      podMemberships: true
    }
  });
  
  console.log('Users with pod memberships:');
  users.forEach(u => {
    console.log(`  ${u.name} (${u.email}) - podId: ${u.podId}, memberships: ${u.podMemberships.length}`);
  });

  // Check competitions
  const comps = await prisma.competition.findMany({
    orderBy: { startsAt: 'desc' },
    take: 5
  });
  
  console.log('\nCompetitions (ordered by startsAt desc):');
  comps.forEach(c => {
    console.log(`  ${c.name} - startsAt: ${c.startsAt}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
