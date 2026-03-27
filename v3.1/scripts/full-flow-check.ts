import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== DATABASE CHECK ===\n');
  
  // 1. Check pods
  const pods = await prisma.pod.findMany({ select: { id: true, name: true } });
  console.log('1. PODS:', pods.length);
  pods.forEach(p => console.log(`   - ${p.id}: ${p.name}`));
  
  // 2. Check memberships for Team Fernando (first pod)
  const firstPodId = pods[0].id;
  const memberships = await prisma.podMembership.findMany({
    where: { podId: firstPodId },
    select: { userId: true }
  });
  console.log(`\n2. MEMBERSHIPS for ${pods[0].name}:`, memberships.length);
  console.log('   User IDs:', memberships.map(m => m.userId.slice(0,8) + '...'));
  
  // 3. Check tracker logs for Feb 3, 2026 UTC
  const feb3Start = new Date(Date.UTC(2026, 1, 3, 0, 0, 0, 0)); // Feb 3, 2026 midnight UTC
  const feb3End = new Date(Date.UTC(2026, 1, 3, 23, 59, 59, 999)); // Feb 3, 2026 end
  
  console.log('\n3. QUERY for Feb 3, 2026 (UTC):');
  console.log(`   Start: ${feb3Start.toISOString()}`);
  console.log(`   End: ${feb3End.toISOString()}`);
  
  const logsFeb3 = await prisma.trackerLog.findMany({
    where: {
      loggedAt: { gte: feb3Start, lte: feb3End }
    },
    select: { userId: true, loggedAt: true, value: true }
  });
  console.log(`   Found: ${logsFeb3.length} logs`);
  logsFeb3.slice(0, 5).forEach(l => {
    console.log(`   - user: ${l.userId.slice(0,8)}... | loggedAt: ${l.loggedAt.toISOString()} | value: ${l.value}`);
  });
  
  // 4. Check logs within membership users
  const userIds = memberships.map(m => m.userId);
  const logsForPod = await prisma.trackerLog.findMany({
    where: {
      userId: { in: userIds },
      loggedAt: { gte: feb3Start, lte: feb3End }
    },
    select: { userId: true, loggedAt: true, value: true }
  });
  console.log(`\n4. LOGS for ${pods[0].name} on Feb 3:`, logsForPod.length);
  
  // 5. Check all logs
  const allLogs = await prisma.trackerLog.findMany({
    select: { userId: true, loggedAt: true, value: true }
  });
  console.log('\n5. ALL LOGS:', allLogs.length);
  allLogs.forEach(l => {
    console.log(`   - ${l.loggedAt.toISOString()} | user: ${l.userId.slice(0,8)}... | value: ${l.value}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
