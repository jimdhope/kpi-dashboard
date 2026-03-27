import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.trackerLog.findMany({
    select: { loggedAt: true, userId: true, trackerKpiId: true, value: true },
    orderBy: { loggedAt: 'asc' }
  });
  
  console.log('All tracker logs:');
  logs.forEach(l => {
    console.log(`  ${l.loggedAt.toISOString()} | user: ${l.userId.slice(0,8)}... | kpi: ${l.trackerKpiId.slice(0,8)}... | value: ${l.value}`);
  });
  
  // Check date ranges
  const dates = logs.map(l => {
    const d = l.loggedAt;
    return {
      utc: d.toISOString(),
      local: d.toLocaleString(),
      startOfDayUTC: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString(),
      startOfDayLocal: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
    };
  });
  
  console.log('\nDate analysis:');
  console.log('First log date (UTC):', dates[0].utc);
  console.log('First log date (Local):', dates[0].local);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
