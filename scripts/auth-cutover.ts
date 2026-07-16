import crypto from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const adminEmail = process.env.CUTOVER_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.CUTOVER_ADMIN_TEMP_PASSWORD;
const resume = process.env.CUTOVER_RESUME === "true";

if (!adminEmail || !adminPassword || adminPassword.length < 8 || adminPassword.length > 128) {
  throw new Error("Set CUTOVER_ADMIN_EMAIL and an 8-128 character CUTOVER_ADMIN_TEMP_PASSWORD.");
}
const cutoverAdminEmail = adminEmail;
const cutoverAdminPassword = adminPassword;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const admin = users.find((user) => user.email.toLowerCase() === cutoverAdminEmail);
  if (!admin) throw new Error(`Cutover administrator ${cutoverAdminEmail} was not found.`);

  const existing = await prisma.account.count({ where: { providerId: "credential" } });
  if (existing > 0 && !resume) {
    throw new Error("Credential accounts already exist. Inspect the database, then set CUTOVER_RESUME=true to fill only missing accounts.");
  }

  for (const user of users) {
    const found = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true },
    });
    if (found) continue;

    const temporaryPassword = user.id === admin.id
      ? cutoverAdminPassword
      : crypto.randomBytes(48).toString("base64url");
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.email.toLowerCase(),
        password: await hashPassword(temporaryPassword),
      },
    });
  }

  await prisma.$transaction([
    prisma.user.updateMany({ data: { mustChangePassword: true, emailVerified: true } }),
    prisma.session.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.rateLimit.deleteMany(),
  ]);

  console.log(`Authentication cutover prepared for ${users.length} users. Existing sessions were invalidated.`);
  console.log("The administrator must change the temporary password at first sign-in.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
