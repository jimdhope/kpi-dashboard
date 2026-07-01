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

  // Badges are now created through the admin UI (Badge Manager).
  // No hard-coded badge seeding needed — start fresh.

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
