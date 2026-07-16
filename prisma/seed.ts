import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
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

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      name: adminName,
    },
    create: {
      email: adminEmail.toLowerCase(),
      name: adminName,
      emailVerified: true,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: adminEmail.toLowerCase() } },
    update: { password: passwordHash, userId: admin.id },
    create: {
      accountId: adminEmail.toLowerCase(),
      providerId: "credential",
      userId: admin.id,
      password: passwordHash,
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

  // Seed default role permissions
  const { permissionService } = await import("@/server/services/permission-service");
  await permissionService.seedDefaults();

  // Badges are now created through the admin UI (Badge Manager).
  // No hard-coded badge seeding needed — start fresh.

}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
