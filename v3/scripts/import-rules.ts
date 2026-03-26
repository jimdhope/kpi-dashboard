import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const EXPORT_FILE = path.join(process.cwd(), "..", "kpi_quest_export.json");

async function main() {
  const data = JSON.parse(fs.readFileSync(EXPORT_FILE, "utf-8"));

  console.log("Importing campaign rules as TrackerKpis...");
  for (const campaignRuleGroup of data.campaignRules || []) {
    const campaignId = campaignRuleGroup.id;
    
    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      console.warn(`Campaign ${campaignId} not found, skipping rules...`);
      continue;
    }

    for (const rule of campaignRuleGroup.rules || []) {
      await prisma.trackerKpi.upsert({
        where: { id: rule.id },
        update: {
          name: rule.name,
          unit: rule.type || "numeric",
          targetValue: rule.points || 0,
        },
        create: {
          id: rule.id,
          campaignId: campaignId,
          name: rule.name,
          unit: rule.type || "numeric",
          targetValue: rule.points || 0,
        },
      });
    }
  }

  console.log("Rule import complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
