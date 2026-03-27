import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get users in KPI logs
  const kpiLogUsers = await prisma.kpiLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  const kpiLogUserIds = kpiLogUsers.map(l => l.userId!);
  
  // Get all pod memberships with user details
  const memberships = await prisma.podMembership.findMany({
    include: { 
      user: { select: { name: true, id: true } },
      pod: { select: { name: true } }
    }
  });
  
  console.log('=== Pod Memberships with User Details ===\n');
  
  memberships.forEach(m => {
    const inKpiLogs = kpiLogUserIds.includes(m.userId);
    console.log(`${m.user.name} | Pod: ${m.pod.name} | User ID: ${m.userId}${inKpiLogs ? ' ✓ IN KPI LOGS' : ' ✗ NOT in KPI logs'}`);
  });
  
  console.log('\n=== Users in KPI Logs NOT in any Pod ===');
  const podUserIds = new Set(memberships.map(m => m.userId));
  const kpiLogOnly = kpiLogUserIds.filter(id => !podUserIds.has(id));
  
  for (const userId of kpiLogOnly) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    console.log(`  ${user?.name} (${userId})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
