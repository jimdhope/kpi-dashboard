import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream, unlinkSync } from "fs";
import { createGzip, createGunzip } from "zlib";
import { PassThrough, Transform } from "stream";
import { prisma } from "@/server/db/client";

interface DbConfig {
  host: string;
  port: number;
  dbname: string;
  user: string;
  password: string;
}

const MAX_TOOL_STDERR_BYTES = 1024 * 1024;
const DATABASE_TOOL_TIMEOUT_MS = 30 * 60 * 1000;
const PRISMA_TOOL_TIMEOUT_MS = 30 * 60 * 1000;

function parseDatabaseUrl(): DbConfig {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "5432"),
    dbname: parsed.pathname.replace(/^\//, ""),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function connFlags(c: DbConfig): string[] {
  return ["--host", c.host, "--port", String(c.port), "--username", c.user, "--dbname", c.dbname];
}

function byteLimit(maxBytes: number): Transform {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length;
      callback(total > maxBytes ? new Error("Expanded backup exceeds the 1 GB limit") : null, chunk);
    },
  });
}

function postgres16Compatibility(): Transform {
  let remainder = "";
  const ignoredStatements = new Set([
    // Emitted by PostgreSQL 17 clients but unsupported by PostgreSQL 16.
    "SET transaction_timeout = 0;",
    // job_common is attached to pgboss.job. PostgreSQL 16 requires its
    // inherited primary key to be removed through the parent constraint.
    'ALTER TABLE IF EXISTS ONLY pgboss.job_common DROP CONSTRAINT IF EXISTS job_common_pkey;',
  ]);
  const filterLine = (line: string) => ignoredStatements.has(line.trim()) ? "" : `${line}\n`;

  return new Transform({
    transform(chunk, _encoding, callback) {
      const input = remainder + chunk.toString("utf8");
      const lines = input.split("\n");
      remainder = lines.pop() ?? "";
      callback(null, lines.map(filterLine).join(""));
    },
    flush(callback) {
      callback(null, ignoredStatements.has(remainder.trim()) ? "" : remainder);
    },
  });
}

function trimStderr(stderr: string, toolName: string, exitCode: number | null): string {
  const detail = stderr.trim();
  return detail || `${toolName} exited with code ${exitCode}`;
}

async function runPrismaMigrateDeploy(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const prismaCli = spawn("npx", ["--yes", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  prismaCli.stderr.on("data", (d) => {
    if (stderr.length < MAX_TOOL_STDERR_BYTES) stderr += d.toString().slice(0, MAX_TOOL_STDERR_BYTES - stderr.length);
  });

  const timeout = setTimeout(() => prismaCli.kill("SIGTERM"), PRISMA_TOOL_TIMEOUT_MS);

  await new Promise<void>((resolve, reject) => {
    prismaCli.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(trimStderr(stderr, "prisma migrate deploy", code)));
    });
    prismaCli.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`prisma migrate deploy failed: ${err.message}`));
    });
  });
}

export const backupService = {
  async exportToGzip(outputPath: string): Promise<void> {
    const config = parseDatabaseUrl();
    const pgDump = spawn("pg_dump", [
      ...connFlags(config),
      "--clean", "--if-exists", "--no-owner", "--no-comments", "--exclude-schema=pgboss",
    ], {
      env: { ...process.env, PGPASSWORD: config.password },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const gzip = createGzip();
    const writeStream = createWriteStream(outputPath);
    let stderr = "";
    pgDump.stderr.on("data", (d) => {
      if (stderr.length < MAX_TOOL_STDERR_BYTES) stderr += d.toString().slice(0, MAX_TOOL_STDERR_BYTES - stderr.length);
    });
    const timeout = setTimeout(() => pgDump.kill("SIGTERM"), DATABASE_TOOL_TIMEOUT_MS);

    const pipelineDone = pipeline(pgDump.stdout, gzip, writeStream);
    const exitDone = new Promise<void>((resolve, reject) => {
      pgDump.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
      });
      pgDump.on("error", reject);
    });

    try {
      await Promise.all([pipelineDone, exitDone]);
    } catch (err) {
      writeStream.destroy();
      throw err;
    }
  },

  async createAutoBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = `/tmp/kpi-quest-auto-backup-${timestamp}.sql.gz`;
    await this.exportToGzip(outputPath);
    return outputPath;
  },

  async restoreFromFile(filePath: string): Promise<void> {
    const config = parseDatabaseUrl();

    const psql = spawn("psql", [
      ...connFlags(config),
      "--quiet", "--single-transaction", "--set", "ON_ERROR_STOP=on",
    ], {
      env: { ...process.env, PGPASSWORD: config.password },
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    psql.stderr.on("data", (d) => {
      if (stderr.length < MAX_TOOL_STDERR_BYTES) stderr += d.toString().slice(0, MAX_TOOL_STDERR_BYTES - stderr.length);
    });
    const timeout = setTimeout(() => psql.kill("SIGTERM"), DATABASE_TOOL_TIMEOUT_MS);
    const input = new PassThrough();
    input.write("DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n");
    const stopOnError = <T>(promise: Promise<T>): Promise<T> =>
      promise.catch((error) => {
        if (!psql.killed) psql.kill("SIGTERM");
        throw error;
      });
    const inputDone = stopOnError(pipeline(input, psql.stdin));
    const fileDone = stopOnError(pipeline(createReadStream(/* turbopackIgnore: true */ filePath), postgres16Compatibility(), input));
    const exitDone = new Promise<void>((resolve, reject) => {
      psql.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `psql exited with code ${code}`));
      });
      psql.on("error", (err) => reject(new Error(`psql failed: ${err.message}`)));
    });

    try {
      const [fileResult, inputResult, exitResult] = await Promise.allSettled([fileDone, inputDone, exitDone]);
      // Prefer PostgreSQL's diagnostic when it exits early. Otherwise a
      // rejected stdin pipeline commonly masks the useful error as EPIPE.
      if (exitResult.status === "rejected") throw exitResult.reason;
      if (inputResult.status === "rejected") throw inputResult.reason;
      if (fileResult.status === "rejected") throw fileResult.reason;
    } catch (error) {
      if (!psql.killed) psql.kill("SIGTERM");
      throw error;
    }

    await runPrismaMigrateDeploy();
  },

  async restoreFromGzip(gzipPath: string): Promise<void> {
    const sqlPath = gzipPath.replace(/\.gz$/, "");
    const gunzip = createGunzip();
    const readStream = createReadStream(/* turbopackIgnore: true */ gzipPath);
    const writeStream = createWriteStream(sqlPath);
    await pipeline(readStream, gunzip, byteLimit(1024 * 1024 * 1024), writeStream);
    try {
      await this.restoreFromFile(sqlPath);
    } finally {
      try { unlinkSync(sqlPath); } catch { /* ignore */ }
    }
  },

  async clearAllData() {
    await prisma.kBComment.deleteMany();
    await prisma.kBVersion.deleteMany();
    await prisma.kBArticle.deleteMany();
    await prisma.kBCategory.deleteMany();
    await prisma.contact.deleteMany();
    await prisma.department.deleteMany();
    await prisma.company.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.rpsGame.deleteMany();
    await prisma.teamsIncomingEvent.deleteMany();
    await prisma.teamsAutomationPendingDelivery.deleteMany();
    await prisma.teamsAutomation.deleteMany();
    await prisma.teamsMessageTemplate.deleteMany();
    await prisma.teamsWebhookEndpoint.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.podTarget.deleteMany();
    await prisma.teamBonusLog.deleteMany();
    await prisma.dailyTaskLog.deleteMany();
    await prisma.dailyAchievement.deleteMany();
    await prisma.competitionScoreLog.deleteMany();
    await prisma.competitionEntry.deleteMany();
    await prisma.competitionTeam.deleteMany();
    await prisma.competitionRule.deleteMany();
    await prisma.competition.deleteMany();
    await prisma.competitionRuleTemplate.deleteMany();
    await prisma.competitionResult.deleteMany();
    await prisma.agentBadge.deleteMany();
    await prisma.badge.deleteMany();
    await prisma.scoreTarget.deleteMany();
    await prisma.trackerLog.deleteMany();
    await prisma.trackerKpi.deleteMany();
    await prisma.podMembership.deleteMany();
    await prisma.pod.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.kpiLog.deleteMany();
    await prisma.kpi.deleteMany();
    await prisma.passkey.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.rateLimit.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.user.deleteMany();
    await prisma.importLog.deleteMany();
  },
};
