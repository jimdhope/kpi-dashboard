import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check users in tracker logs
  const logUserIds = await prisma.trackerLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  
  console.log('Users in tracker logs:', logUserIds.length);
  logUserIds.forEach(u => console.log('  -', u.userId));
  
  // Check pod memberships
  const memberships = await prisma.podMembership.findMany({
    include: { user: { select: { name: true } }, pod: { select: { name: true } } }
  });
  
  console.log('\nAll pod memberships:', memberships.length);
  memberships.slice(0, 10).forEach(m => {
    console.log(`  - ${m.user.name} -> ${m.pod.name}`);
  });
  
  // Check if log users have memberships
  console.log('\nChecking if log users have pod memberships...');
  for (const { userId } of logUserIds) {
    const membership = memberships.find(m => m.userId === userId);
    if (!membership) {
      console.log(`  WARNING: User ${userId.slice(0,8)} has NO pod membership!`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
