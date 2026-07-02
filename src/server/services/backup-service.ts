import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import { createWriteStream, createReadStream, unlinkSync } from "fs";
import { createGzip, createGunzip } from "zlib";
import { prisma } from "@/server/db/client";

interface DbConfig {
  host: string;
  port: number;
  dbname: string;
  user: string;
  password: string;
}

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

export const backupService = {
  async exportToGzip(outputPath: string): Promise<void> {
    const config = parseDatabaseUrl();
    const pgDump = spawn("pg_dump", [
      ...connFlags(config),
      "--clean", "--if-exists", "--no-owner", "--no-comments",
    ], {
      env: { ...process.env, PGPASSWORD: config.password },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const gzip = createGzip();
    const writeStream = createWriteStream(outputPath);
    let stderr = "";
    pgDump.stderr.on("data", (d) => { stderr += d.toString(); });

    const pipelineDone = pipeline(pgDump.stdout, gzip, writeStream);
    const exitDone = new Promise<void>((resolve, reject) => {
      pgDump.on("close", (code) => {
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

    return new Promise((resolve, reject) => {
      const psql = spawn("psql", [
        ...connFlags(config),
        "--quiet", "-f", filePath,
      ], {
        env: { ...process.env, PGPASSWORD: config.password },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      psql.stderr.on("data", (d) => { stderr += d.toString(); });

      psql.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `psql exited with code ${code}`));
      });
      psql.on("error", (err) => reject(new Error(`psql failed: ${err.message}`)));
    });
  },

  async restoreFromGzip(gzipPath: string): Promise<void> {
    const sqlPath = gzipPath.replace(/\.gz$/, "");
    const gunzip = createGunzip();
    const readStream = createReadStream(gzipPath);
    const writeStream = createWriteStream(sqlPath);
    await pipeline(readStream, gunzip, writeStream);
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
    await prisma.appPushSettings.deleteMany();
    await prisma.userNotificationSettings.deleteMany();
    await prisma.notification.deleteMany();
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
    await prisma.session.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.importLog.deleteMany();
  },
};
