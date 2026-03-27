import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all pods
  const pods = await prisma.pod.findMany({
    select: { id: true, name: true }
  });
  console.log('=== PODS ===');
  pods.forEach(p => console.log(`  ${p.id}: ${p.name}`));
  
  // Get all memberships with user info
  const memberships = await prisma.podMembership.findMany({
    include: { 
      user: { select: { id: true, name: true } },
      pod: { select: { id: true, name: true } }
    }
  });
  console.log('\n=== MEMBERSHIPS ===');
  console.log(`Total: ${memberships.length}`);
  
  // Group by pod
  const byPod = new Map<string, string[]>();
  memberships.forEach(m => {
    if (!byPod.has(m.pod.id)) byPod.set(m.pod.id, []);
    byPod.get(m.pod.id)!.push(m.user.name);
  });
  byPod.forEach((members, podId) => {
    const pod = pods.find(p => p.id === podId);
    console.log(`\n${pod?.name} (${podId.slice(0,8)}):`);
    members.forEach(m => console.log(`  - ${m}`));
  });
  
  // Get tracker logs user IDs
  const logUsers = await prisma.trackerLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  const logUserIds = new Set(logUsers.map(l => l.userId));
  
  // Check which log users have memberships
  console.log('\n=== LOG USERS MEMBERSHIP STATUS ===');
  memberships.forEach(m => {
    if (logUserIds.has(m.user.id)) {
      console.log(`  ${m.user.name} (${m.user.id.slice(0,8)}) -> ${m.pod.name}: HAS LOGS ✓`);
    }
  });
  
  // Check if any log users have NO membership
  const membershipUserIds = new Set(memberships.map(m => m.user.id));
  let unmatched = 0;
  logUsers.forEach(l => {
    if (!membershipUserIds.has(l.userId)) {
      console.log(`  ${l.userId.slice(0,8)}: NO MEMBERSHIP ❌`);
      unmatched++;
    }
  });
  if (unmatched === 0) console.log('  All log users have memberships ✓');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
