import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleKey } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kpi_quest_v3";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const roleLabels: Record<RoleKey, string> = {
  admin: "Admin",
  campaignManager: "Campaign Manager",
  podManager: "Pod Manager",
  teamLeader: "Team Leader",
  competitionRunner: "Competition Runner",
  agent: "Agent",
};

async function main() {
  for (const roleKey of Object.values(RoleKey)) {
    await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: roleLabels[roleKey] },
      create: { key: roleKey, name: roleLabels[roleKey] },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@kpi-quest.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123!";
  const adminName = process.env.SEED_ADMIN_NAME ?? "V3 Admin";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: adminName,
      passwordHash,
    },
    create: {
      email: adminEmail.toLowerCase(),
      name: adminName,
      passwordHash,
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { key: RoleKey.admin },
  });

  const agentRole = await prisma.role.findUniqueOrThrow({
    where: { key: RoleKey.agent },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: agentRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: agentRole.id,
    },
  });

  const badgeDefs = [
    { key: "first_win", name: "First Win", description: "Awarded for finishing 1st in a competition", category: "competition", iconUrl: "/badges/first_win.png" },
    { key: "podium", name: "Podium Finish", description: "Awarded for placing in the top 3", category: "competition", iconUrl: "/badges/podium.png" },
    { key: "veteran", name: "Veteran", description: "Completed 10 competitions", category: "achievement", iconUrl: "/badges/veteran.png" },
    { key: "comeback_kid", name: "Comeback Kid", description: "Massive rank improvement", category: "achievement", iconUrl: "/badges/comeback_kid.png" },
    { key: "score_machine", name: "Score Machine", description: "Achieved the highest score ever", category: "achievement", iconUrl: "/badges/score_machine.png" },
    { key: "perfect_attendance", name: "Perfect Attendance", description: "Perfect attendance in a competition", category: "attendance", iconUrl: "/badges/perfect_attendance.png" },
    { key: "streak_3", name: "3-Win Streak", description: "Won 3 competitions in a row", category: "streak", iconUrl: "/badges/streak_3.png" },
    { key: "streak_5", name: "5-Win Streak", description: "Won 5 competitions in a row", category: "streak", iconUrl: "/badges/streak_5.png" },
    { key: "streak_10", name: "10-Win Streak", description: "Won 10 competitions in a row", category: "streak", iconUrl: "/badges/streak_10.png" },
    { key: "three_peat", name: "Three-Peat", description: "3 consecutive wins", category: "streak", iconUrl: "/badges/three_peat.png" },
    { key: "monthly_champion", name: "Monthly Champion", description: "Top agent of the month", category: "monthly", iconUrl: "/badges/monthly_champion.png" },
    { key: "monthly_top3", name: "Monthly Top 3", description: "Among top 3 agents of the month", category: "monthly", iconUrl: "/badges/monthly_top3.png" },
  ];

  for (let i = 0; i < badgeDefs.length; i++) {
    const b = badgeDefs[i];
    await prisma.badge.upsert({
      where: { key: b.key },
      update: { name: b.name, description: b.description, iconUrl: b.iconUrl, sortOrder: i },
      create: { key: b.key, name: b.name, description: b.description, iconUrl: b.iconUrl, sortOrder: i },
    });
  }

  const existingNotifications = await prisma.notification.count({
    where: { userId: admin.id },
  });

  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: admin.id,
          type: "system_alert",
          title: "V3 foundation ready",
          message: "Postgres, Prisma, app-owned auth, and notifications are wired in this workspace.",
          priority: "high",
          actionUrl: "/notifications",
        },
        {
          userId: admin.id,
          type: "team_update",
          title: "Admin slice seeded",
          message: "Use the Admin Users screen to create the first V3 operators.",
          priority: "medium",
          actionUrl: "/admin/users",
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
