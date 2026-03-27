import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.kpiLog.count();
  console.log('Total KPI logs in database:', total);
  
  // Check Team Harvey
  const teamHarveyPods = await prisma.pod.findMany({
    where: { name: { contains: 'Harvey' } },
    select: { id: true, name: true }
  });
  
  console.log('\nHarvey pods:', teamHarveyPods);
  
  // Count logs for Harvey users
  const harveyPodId = teamHarveyPods[0]?.id;
  if (harveyPodId) {
    const memberships = await prisma.podMembership.findMany({
      where: { podId: harveyPodId },
      select: { userId: true }
    });
    const userIds = memberships.map(m => m.userId);
    
    const harveyLogs = await prisma.kpiLog.count({
      where: { userId: { in: userIds } }
    });
    
    console.log('\nHarvey pod ID:', harveyPodId);
    console.log('Harvey users:', userIds.length);
    console.log('Harvey KPI logs:', harveyLogs);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
