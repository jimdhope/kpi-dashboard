import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const EXPORT_FILE = path.join(process.cwd(), "..", "kpi_quest_export.json");

async function main() {
  const data = JSON.parse(fs.readFileSync(EXPORT_FILE, "utf-8"));

  console.log("Importing competitions...");
  for (const comp of data.competitions || []) {
    
    let startsAt = new Date(comp.startDate);
    let endsAt = new Date(comp.endDate);

    if (comp.name === "Black Friday 2025") {
       console.log("Setting Black Friday 2025 as the ACTIVE demo competition.");
       startsAt = new Date();
       startsAt.setDate(startsAt.getDate() - 1);
       endsAt = new Date();
       endsAt.setDate(endsAt.getDate() + 7);
    }

    const competition = await prisma.competition.upsert({
      where: { id: comp.id },
      update: {
        name: comp.name,
        startsAt,
        endsAt,
      },
      create: {
        id: comp.id,
        name: comp.name,
        startsAt,
        endsAt,
      },
    });

    // Rules
    for (const rule of comp.rules || []) {
      await prisma.competitionRule.upsert({
        where: { id: rule.id },
        update: { title: rule.name, points: rule.points || 0 },
        create: {
          id: rule.id,
          competitionId: competition.id,
          title: rule.name,
          points: rule.points || 0,
        },
      });
    }

    // Clean up existing entries for this competition before sync
    await prisma.competitionEntry.deleteMany({
      where: { competitionId: competition.id }
    });

    // Teams & Participants (Entries)
    for (const team of comp.teams || []) {
      const dbTeam = await prisma.competitionTeam.upsert({
        where: { id: team.id },
        update: { name: team.name },
        create: {
          id: team.id,
          competitionId: competition.id,
          name: team.name,
        },
      });

      for (const agentId of team.agentIds || []) {
        const user = await prisma.user.findFirst({
           where: { id: agentId }
        });

        if (user) {
          await prisma.competitionEntry.create({
            data: {
              userId: user.id,
              competitionId: competition.id,
            },
          });
        }
      }
    }
  }

  console.log("Competition import complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
