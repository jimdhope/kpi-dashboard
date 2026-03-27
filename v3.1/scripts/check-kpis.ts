import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log('=== KPI DATA CHECK ===\n');
  
  // 1. Check Kpi model
  const kpis = await prisma.kPI.findMany({
    select: { id: true, name: true, description: true, unit: true }
  });
  console.log('1. KPIs in database:', kpis.length);
  kpis.forEach(k => console.log(`   - ${k.id.slice(0,8)}: ${k.name} | unit: ${k.unit || 'none'}`));
  
  // 2. Check TrackerKpi model (used by trackers)
  const trackerKpis = await prisma.trackerKpi.findMany({
    select: { id: true, name: true, unit: true }
  });
  console.log('\n2. TrackerKPIs in database:', trackerKpis.length);
  trackerKpis.forEach(k => console.log(`   - ${k.id.slice(0,8)}: ${k.name}`));
  
  // 3. Check if there's data in V2 exports for KPIs
  console.log('\n3. V2 Export files check:');
  const fs = await import('fs');
  const path = await import('path');
  const exportsDir = path.join(process.cwd(), 'scripts', 'exports');
  
  const kpisExport = path.join(exportsDir, 'kpis.json');
  const performanceExport = path.join(exportsDir, 'performanceKpis.json');
  
  console.log('   kpis.json exists:', fs.existsSync(kpisExport));
  console.log('   performanceKpis.json exists:', fs.existsSync(performanceExport));
  
  if (fs.existsSync(kpisExport)) {
    const data = JSON.parse(fs.readFileSync(kpisExport, 'utf-8'));
    console.log('   kpis.json entries:', data.length);
  }
  if (fs.existsSync(performanceExport)) {
    const data = JSON.parse(fs.readFileSync(performanceExport, 'utf-8'));
    console.log('   performanceKpis.json entries:', data.length);
  }
  
  // 4. Check PerformanceLog model
  const perfLogs = await prisma.performanceLog.count();
  console.log('\n4. PerformanceLog count:', perfLogs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
