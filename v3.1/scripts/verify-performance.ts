import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== Performance Data Verification ===\n');
  
  // Check KPIs
  const kpis = await prisma.kpi.findMany({
    select: { id: true, name: true, initials: true, type: true }
  });
  console.log('KPIs:', kpis.length);
  kpis.forEach(k => console.log(`  - ${k.initials}: ${k.name} (${k.type})`));
  
  // Check KPI Logs
  const kpiLogs = await prisma.kpiLog.findMany({
    select: { id: true, kpiId: true, userId: true, value: true, loggedAt: true },
    take: 5
  });
  console.log('\nKPI Logs:', await prisma.kpiLog.count(), 'total');
  console.log('Sample logs:');
  kpiLogs.forEach(l => {
    console.log(`  - ${l.kpiId.slice(0,8)}... | user: ${l.userId?.slice(0,8)}... | value: ${l.value} | date: ${l.loggedAt.toISOString().split('T')[0]}`);
  });
  
  // Check date range
  const oldest = await prisma.kpiLog.findFirst({ orderBy: { loggedAt: 'asc' } });
  const newest = await prisma.kpiLog.findFirst({ orderBy: { loggedAt: 'desc' } });
  console.log('\nDate range:', oldest?.loggedAt.toISOString().split('T')[0], 'to', newest?.loggedAt.toISOString().split('T')[0]);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
