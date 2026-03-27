import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== KPI Logs Diagnostic ===\n');
  
  // 1. Check KPI logs count
  const kpiLogsCount = await prisma.kpiLog.count();
  console.log('1. KPI Logs Total:', kpiLogsCount);
  
  // 2. Check distinct users in KPI logs
  const kpiLogUsers = await prisma.kpiLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  console.log('\n2. Unique users in KPI logs:', kpiLogUsers.length);
  
  // 3. Check pod memberships
  const podMemberships = await prisma.podMembership.findMany({
    select: { userId: true, podId: true }
  });
  console.log('\n3. Pod memberships:', podMemberships.length);
  
  // Group memberships by pod
  const byPod = new Map<string, number>();
  podMemberships.forEach(m => {
    byPod.set(m.podId, (byPod.get(m.podId) || 0) + 1);
  });
  console.log('   By pod:');
  byPod.forEach((count, podId) => {
    console.log(`   - ${podId.slice(0,8)}...: ${count} members`);
  });
  
  // 4. Check overlap between KPI log users and pod members
  const podUserIds = new Set(podMemberships.map(m => m.userId));
  const kpiLogUserIds = new Set(kpiLogUsers.map(l => l.userId));
  
  const inBoth = [...kpiLogUserIds].filter(id => podUserIds.has(id));
  const onlyInLogs = [...kpiLogUserIds].filter(id => !podUserIds.has(id));
  const onlyInPods = [...podUserIds].filter(id => !kpiLogUserIds.has(id));
  
  console.log('\n4. User ID overlap:');
  console.log(`   Users in BOTH KPI logs AND pods: ${inBoth.length}`);
  console.log(`   Users ONLY in KPI logs (no pod): ${onlyInLogs.length}`);
  console.log(`   Users ONLY in pods (no KPI logs): ${onlyInPods.length}`);
  
  if (onlyInLogs.length > 0) {
    console.log('\n   Sample users in logs but NOT in pods:');
    onlyInLogs.slice(0, 3).forEach(id => console.log(`   - ${id}`));
  }
  
  // 5. Check KPI logs by date
  const earliest = await prisma.kpiLog.findFirst({ orderBy: { loggedAt: 'asc' } });
  const latest = await prisma.kpiLog.findFirst({ orderBy: { loggedAt: 'desc' } });
  
  console.log('\n5. KPI Log Date Range:');
  console.log(`   Earliest: ${earliest?.loggedAt.toISOString()}`);
  console.log(`   Latest: ${latest?.loggedAt.toISOString()}`);
  
  // 6. Check sample KPI logs with user names
  console.log('\n6. Sample KPI Logs (with user names):');
  const sampleLogs = await prisma.kpiLog.findMany({
    take: 5,
    include: { user: { select: { name: true } }, kpi: { select: { name: true } } },
    orderBy: { loggedAt: 'desc' }
  });
  
  sampleLogs.forEach(log => {
    console.log(`   - ${log.user?.name || 'NO USER'} | ${log.kpi.name} | ${log.value} | ${log.loggedAt.toISOString().split('T')[0]}`);
  });
  
  // 7. Check if users have firebaseUid mapping
  console.log('\n7. User firebaseUid mapping:');
  const usersWithLogs = await prisma.user.findMany({
    where: { id: { in: [...kpiLogUserIds] } },
    select: { id: true, name: true, firebaseUid: true }
  });
  
  console.log(`   Users in KPI logs: ${usersWithLogs.length}`);
  const withFirebaseUid = usersWithLogs.filter(u => u.firebaseUid);
  const withoutFirebaseUid = usersWithLogs.filter(u => !u.firebaseUid);
  console.log(`   With Firebase UID: ${withFirebaseUid.length}`);
  console.log(`   WITHOUT Firebase UID: ${withoutFirebaseUid.length}`);
  
  if (withoutFirebaseUid.length > 0) {
    console.log('\n   Users in KPI logs but NO firebaseUid:');
    withoutFirebaseUid.slice(0, 5).forEach(u => console.log(`   - ${u.name} (${u.id.slice(0,8)}...)`));
  }
  
  // 8. Test what the API would return for a specific pod
  console.log('\n8. API Query Simulation:');
  const pods = await prisma.pod.findMany({ take: 1 });
  if (pods.length > 0) {
    const firstPod = pods[0];
    console.log(`   Pod: ${firstPod.name} (${firstPod.id})`);
    
    const podMembershipsForQuery = await prisma.podMembership.findMany({
      where: { podId: firstPod.id },
      select: { userId: true }
    });
    console.log(`   Members in pod: ${podMembershipsForQuery.length}`);
    
    const logsForPod = await prisma.kpiLog.findMany({
      where: { userId: { in: podMembershipsForQuery.map(m => m.userId) } },
      take: 5
    });
    console.log(`   KPI logs for pod members: ${logsForPod.length}`);
    
    if (logsForPod.length === 0 && podMembershipsForQuery.length > 0) {
      console.log('   ⚠️  PROBLEM: Pod has members but no KPI logs!');
      console.log('   Pod member IDs:', podMembershipsForQuery.map(m => m.userId.slice(0,8) + '...'));
      
      // Check if KPI log user IDs match pod member IDs
      const podMemberIds = new Set(podMembershipsForQuery.map(m => m.userId));
      const kpiLogUserIds2 = new Set(kpiLogUsers.map(l => l.userId));
      const match = [...podMemberIds].filter(id => kpiLogUserIds2.has(id));
      console.log(`   Matching user IDs: ${match.length}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
