import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== User ID Analysis ===\n');
  
  // 1. Get KPI log users with their database IDs
  const kpiLogUsers = await prisma.kpiLog.findMany({
    select: { userId: true },
    distinct: ['userId']
  });
  
  // 2. Get their full details from User table
  const kpiLogUserIds = kpiLogUsers.map(l => l.userId!);
  const kpiLogUsersFull = await prisma.user.findMany({
    where: { id: { in: kpiLogUserIds } },
    select: { id: true, name: true, firebaseUid: true, email: true }
  });
  
  console.log('Users in KPI Logs:');
  kpiLogUsersFull.forEach(u => {
    console.log(`  ${u.name} | ${u.id} | firebase: ${u.firebaseUid || 'NONE'}`);
  });
  
  // 3. Get all users with firebaseUid
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, firebaseUid: true, email: true }
  });
  
  console.log('\n\nAll users in database:');
  allUsers.forEach(u => {
    console.log(`  ${u.name} | ${u.id} | firebase: ${u.firebaseUid || 'NONE'}`);
  });
  
  // 4. Check if KPI log user IDs look like they could be firebase UIDs
  console.log('\n\n=== Checking ID patterns ===');
  console.log('KPI Log user IDs (first 5):');
  kpiLogUserIds.slice(0, 5).forEach(id => console.log(`  ${id}`));
  
  console.log('\nUsers with firebaseUid matching KPI log IDs:');
  const matchingUsers = allUsers.filter(u => kpiLogUserIds.includes(u.firebaseUid || ''));
  console.log(`  Found: ${matchingUsers.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
