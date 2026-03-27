import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pods = await prisma.pod.findMany({
    select: { id: true, name: true }
  });
  
  console.log('V3 Pods:');
  pods.forEach(p => {
    console.log(`  ${p.name}: ${p.id}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
