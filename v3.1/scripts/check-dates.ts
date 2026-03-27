import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== KPI Logs by Date ===\n');
  
  // Get all KPI logs grouped by date
  const logs = await prisma.kpiLog.findMany({
    select: { loggedAt: true, userId: true, kpiId: true, value: true },
    orderBy: { loggedAt: 'desc' }
  });
  
  // Group by date
  const byDate = new Map<string, number>();
  logs.forEach(log => {
    const date = log.loggedAt.toISOString().split('T')[0];
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });
  
  console.log('Dates with KPI logs (newest first):');
  const sortedDates = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  sortedDates.slice(0, 30).forEach(([date, count]) => {
    console.log(`  ${date}: ${count} logs`);
  });
  
  // Check specific dates
  console.log('\n\nSpecific dates you tested:');
  ['2026-03-18', '2026-03-11', '2026-03-04'].forEach(date => {
    const count = byDate.get(date) || 0;
    console.log(`  ${date}: ${count} logs ${count > 0 ? '✓' : '✗ NO DATA'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
