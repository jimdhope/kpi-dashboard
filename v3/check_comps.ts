import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const comps = await prisma.competition.findMany({
    select: { id: true, name: true, podIds: true, startsAt: true }
  });
  
  console.log('Competitions with podIds:');
  comps.forEach(c => {
    console.log(`  ${c.name}: podIds = ${JSON.stringify(c.podIds)}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
