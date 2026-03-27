import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface V2TrackerKpi {
  id: string;
  initials: string;
  type: string;
  name: string;
}

interface V2TrackerLog {
  id: string;
  date: string;
  agentId: string;
  trackerKpiId: string;
  loggedAt: string;
  value: number;
  podId: string;
}

async function main() {
  console.log("Starting tracker data import from V2 export...\n");

  // Load V2 export data
  const exportsDir = path.join(process.cwd(), "scripts", "exports");
  
  // 1. Import TrackerKpis
  const kpisPath = path.join(exportsDir, "trackerKpis.json");
  if (!fs.existsSync(kpisPath)) {
    console.error("trackerKpis.json not found");
    process.exit(1);
  }
  const v2Kpis: V2TrackerKpi[] = JSON.parse(fs.readFileSync(kpisPath, "utf-8"));
  
  console.log(`Importing ${v2Kpis.length} TrackerKPIs...`);
  for (const kpi of v2Kpis) {
    await prisma.trackerKpi.upsert({
      where: { id: kpi.id },
      update: {
        name: kpi.name,
        unit: kpi.initials || null,
      },
      create: {
        id: kpi.id,
        name: kpi.name,
        unit: kpi.initials || null,
      },
    });
    console.log(`  - Imported KPI: ${kpi.name}`);
  }

  // 2. Build user mapping (V2 Firebase UID -> V3 User ID)
  console.log("\nBuilding user mapping from V2 Firebase UIDs...");
  const users = await prisma.user.findMany({
    select: { id: true, firebaseUid: true },
  });
  
  const userIdMap = new Map<string, string>();
  for (const user of users) {
    if (user.firebaseUid) {
      userIdMap.set(user.firebaseUid, user.id);
    }
  }
  console.log(`  - Found ${userIdMap.size} users with Firebase UIDs`);

  // 3. Import TrackerLogs
  const logsPath = path.join(exportsDir, "trackerLogs.json");
  if (!fs.existsSync(logsPath)) {
    console.error("trackerLogs.json not found");
    process.exit(1);
  }
  const v2Logs: V2TrackerLog[] = JSON.parse(fs.readFileSync(logsPath, "utf-8"));
  
  console.log(`\nImporting ${v2Logs.length} TrackerLogs...`);
  
  let importedCount = 0;
  let skippedCount = 0;
  
  for (const log of v2Logs) {
    // Map V2 agentId (Firebase UID) to V3 userId
    const v3UserId = userIdMap.get(log.agentId);
    
    if (!v3UserId) {
      console.log(`  - SKIPPED: No V3 user found for V2 agentId ${log.agentId}`);
      skippedCount++;
      continue;
    }

    // Check if KPI exists in V3
    const kpiExists = await prisma.trackerKpi.findUnique({
      where: { id: log.trackerKpiId },
    });
    
    if (!kpiExists) {
      console.log(`  - SKIPPED: No KPI found for trackerKpiId ${log.trackerKpiId}`);
      skippedCount++;
      continue;
    }

    // Check for duplicate (same user, KPI, and loggedAt time)
    const existingLog = await prisma.trackerLog.findFirst({
      where: {
        userId: v3UserId,
        trackerKpiId: log.trackerKpiId,
        loggedAt: new Date(log.loggedAt),
      },
    });

    if (existingLog) {
      // Update value if different
      if (existingLog.value.toNumber() !== log.value) {
        await prisma.trackerLog.update({
          where: { id: existingLog.id },
          data: { value: log.value },
        });
        console.log(`  - Updated log for user ${v3UserId}, KPI ${log.trackerKpiId}: ${log.value}`);
      }
    } else {
      // Create new log
      await prisma.trackerLog.create({
        data: {
          userId: v3UserId,
          trackerKpiId: log.trackerKpiId,
          value: log.value,
          loggedAt: new Date(log.loggedAt),
        },
      });
      importedCount++;
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   - KPIs imported: ${v2Kpis.length}`);
  console.log(`   - Logs imported: ${importedCount}`);
  console.log(`   - Logs skipped: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
