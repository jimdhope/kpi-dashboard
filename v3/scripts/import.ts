import { PrismaClient, RoleKey, User } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EXPORT_FILE = path.join(process.cwd(), "..", "kpi_quest_export.json");
const DEFAULT_PASSWORD = "Password123!"; // V3 standard default
const PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

async function main() {
  console.log("Starting data import from V2 export...");

  if (!fs.existsSync(EXPORT_FILE)) {
    console.error(`Export file not found at ${EXPORT_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(EXPORT_FILE, "utf-8"));

  // 1. Initialize Roles if missing
  console.log("Initializing roles...");
  for (const key of Object.values(RoleKey)) {
    await prisma.role.upsert({
      where: { key },
      update: {},
      create: { key, name: key.replace(/([A-Z])/g, ' $1').trim() },
    });
  }

  const roleMap = new Map();
  const dbRoles = await prisma.role.findMany();
  dbRoles.forEach(r => roleMap.set(r.key, r.id));

  // 2. Import Campaigns
  console.log(`Importing ${data.campaigns?.length || 0} campaigns...`);
  for (const campaign of data.campaigns || []) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      update: { name: campaign.name },
      create: { 
        id: campaign.id, 
        name: campaign.name,
      },
    });
  }

  // 3. Import Users
  console.log(`Importing ${data.users?.length || 0} users...`);
  for (const user of data.users || []) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        // Update roles logic
      },
      create: {
        id: user.id || undefined,
        email: user.email,
        name: user.name,
        passwordHash: PASSWORD_HASH,
      },
    });

    // Handle Roles for this user
    const userInDb = await prisma.user.findUnique({ where: { email: user.email } });
    if (userInDb && user.roles) {
      for (const roleKey of user.roles) {
        const roleId = roleMap.get(roleKey as RoleKey);
        if (roleId) {
          await prisma.userRole.upsert({
            where: {
              userId_roleId: {
                userId: userInDb.id,
                roleId: roleId,
              },
            },
            update: {},
            create: {
              userId: userInDb.id,
              roleId: roleId,
            },
          });
        }
      }
    }
  }

  // 4. Import Pods
  console.log(`Importing ${data.pods?.length || 0} pods...`);
  for (const pod of data.pods || []) {
    await prisma.pod.upsert({
      where: { id: pod.id },
      update: {
        name: pod.name,
        campaignId: pod.campaignId,
      },
      create: {
        id: pod.id,
        name: pod.name,
        campaignId: pod.campaignId,
      },
    });
  }

  // 5. Import Memberships
  console.log("Syncing pod memberships...");
  // Use users' podId as source of truth for current state
  for (const user of data.users || []) {
    if (user.podId) {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (dbUser) {
        await prisma.podMembership.upsert({
          where: {
            podId_userId: {
              userId: dbUser.id,
              podId: user.podId,
            },
          },
          update: {},
          create: {
            userId: dbUser.id,
            podId: user.podId,
          },
        });
      }
    }
  }

  console.log("Import complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
