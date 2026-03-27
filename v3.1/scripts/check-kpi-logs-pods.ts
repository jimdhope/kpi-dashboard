import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get users in KPI logs
  const kpiLogUsers = await prisma.kpiLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  const kpiLogUserIds = new Set(kpiLogUsers.map(l => l.userId));
  
  // Get pod memberships
  const memberships = await prisma.podMembership.findMany({
    include: { 
      user: { select: { name: true } },
      pod: { select: { id: true, name: true } }
    }
  });
  
  // Find pods with KPI log users
  const podsWithLogs = new Map<string, { name: string, count: number }>();
  
  memberships.forEach(m => {
    if (kpiLogUserIds.has(m.userId)) {
      const current = podsWithLogs.get(m.podId) || { name: m.pod.name, count: 0 };
      current.count++;
      podsWithLogs.set(m.podId, current);
    }
  });
  
  console.log('Pods with KPI log users:');
  podsWithLogs.forEach((data, podId) => {
    console.log(`  ${data.name} (${podId}): ${data.count} users`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
