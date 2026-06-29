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

  // ── Badge Catalog ──
  const BADGES = [
    { key: "first_win",         name: "First Blood",           description: "Finish 1st in a competition",                  icon: "Trophy",     category: "competition", sortOrder: 1 },
    { key: "podium",            name: "Podium Finish",         description: "Place in the top 3 of a competition",          icon: "Medal",      category: "competition", sortOrder: 2 },
    { key: "veteran",           name: "Veteran",               description: "Complete 10 competitions",                     icon: "Shield",     category: "competition", sortOrder: 3 },
    { key: "comeback_kid",      name: "Comeback Kid",          description: "Improve rank by 5+ positions",                 icon: "TrendingUp", category: "competition", sortOrder: 4 },
    { key: "score_machine",     name: "Score Machine",         description: "Achieve the highest score ever",               icon: "Zap",        category: "competition", sortOrder: 5 },
    { key: "perfect_attendance",name: "Iron Will",             description: "Perfect attendance in a competition",          icon: "CalendarCheck", category: "competition", sortOrder: 6 },
    { key: "team_winner",       name: "Team Player",           description: "Be on the winning team",                      icon: "Users",      category: "competition", sortOrder: 7 },
    { key: "three_peat",        name: "Three-Peat",            description: "Win 3 competitions in a row",                  icon: "Repeat",     category: "streak",      sortOrder: 8 },
    { key: "streak_3",          name: "On Fire",               description: "Win streak of 3",                              icon: "Flame",      category: "streak",      sortOrder: 9 },
    { key: "streak_5",          name: "Unstoppable",           description: "Win streak of 5",                              icon: "Flame",      category: "streak",      sortOrder: 10 },
    { key: "streak_10",         name: "Legendary",             description: "Win streak of 10",                             icon: "Award",      category: "streak",      sortOrder: 11 },
    { key: "monthly_champion",  name: "Monthly Champion",      description: "Rank 1 in the monthly leaderboard",           icon: "Crown",      category: "monthly",    sortOrder: 12 },
    { key: "monthly_top3",      name: "Monthly All-Star",      description: "Rank in the top 3 of the monthly leaderboard", icon: "Star",      category: "monthly",    sortOrder: 13 },
    { key: "yearly_champion",   name: "Year-End Champion",     description: "Rank 1 in the yearly leaderboard",            icon: "Trophy",     category: "monthly",    sortOrder: 14 },
  ];

  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      update: { name: badge.name, description: badge.description, icon: badge.icon, category: badge.category, sortOrder: badge.sortOrder },
      create: { ...badge, svgPath: `badges/templates/${badge.key}.svg`, criteria: {} },
    });
  }

  console.log(`Seeded ${BADGES.length} badges.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
