/**
 * One-off repair utility: finds competitions whose endsAt (or startsAt) landed
 * at 22:00/23:00 UTC — the signature of the wizard timezone bug, where a picked
 * local calendar day was stored as local midnight minus one hour — and offers
 * to bump them to the true end of the intended local day.
 *
 * Read-only by default. Pass --apply to write.
 *
 * Usage (local):
 *   npx tsx scripts/repair-competition-end-dates.ts            # preview
 *   npx tsx scripts/repair-competition-end-dates.ts --apply    # write
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { endOfDay } from "date-fns";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/kpi_quest_v3",
});
const adapter = new PrismaPg(pool);

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter });

/** A UTC hour of 22 or 23 on a date boundary is almost certainly the tz bug. */
function looksLikeTzBug(d: Date): boolean {
  const h = d.getUTCHours();
  return h === 22 || h === 23;
}

async function main() {
  const comps = await prisma.competition.findMany({
    where: { endsAt: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, startsAt: true, endsAt: true },
  });

  const broken = comps.filter((c) => c.endsAt && looksLikeTzBug(c.endsAt));

  if (broken.length === 0) {
    console.log("No competitions with suspicious end dates found.");
    return;
  }

  console.log(`Found ${broken.length} competition(s) with likely timezone-shifted end dates:\n`);
  for (const c of broken) {
    const intendedEnd = endOfDay(new Date(c.endsAt!));
    console.log(
      `- ${c.name} (${c.id})\n    current endsAt: ${c.endsAt?.toISOString()}\n` +
        `    proposed:       ${intendedEnd.toISOString()} (end of local day)\n`,
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write these changes.");
    return;
  }

  let fixed = 0;
  for (const c of broken) {
    await prisma.competition.update({
      where: { id: c.id },
      data: { endsAt: endOfDay(new Date(c.endsAt!)) },
    });
    fixed += 1;
    console.log(`fixed: ${c.name}`);
  }
  console.log(`\nDone. ${fixed} competition(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
