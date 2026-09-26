import { performanceDashboardService } from "@/server/services/performance-dashboard-service";
import { renderPerformanceCertificatePng, type PerformanceCertData } from "@/server/services/performance-certificate-service";
import { errorResponse } from "@/server/http";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kpiId = searchParams.get("kpiId");
    const all = searchParams.get("all") === "true";
    const timeframe = searchParams.get("timeframe") || "last6weeks";
    const podId = searchParams.get("podId") || undefined;

    const dashboardData = await performanceDashboardService.getData(podId);

    if (all) {
      const zip = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zip.on("data", (chunk: Buffer) => chunks.push(chunk));
        zip.on("error", reject);
        zip.on("end", resolve);

        Promise.all(
          dashboardData.kpis.map(async (kpi) => {
            const certData = computeCertDataForKpi(dashboardData, kpi.id, timeframe);
            const png = await renderPerformanceCertificatePng(certData);
            const filename = `performance-certificate-${kpi.initials || kpi.name.replace(/\s+/g, "-").toLowerCase()}-${timeframe}.png`;
            zip.append(png, { name: filename });
          }),
        ).then(() => zip.finalize());
      });

      const zipBuffer = Buffer.concat(chunks);
      return new Response(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="performance-certificates-${timeframe}.zip"`,
        },
      });
    }

    if (!kpiId) {
      return errorResponse(400, "kpiId is required");
    }

    const certData = computeCertDataForKpi(dashboardData, kpiId, timeframe);
    const png = await renderPerformanceCertificatePng(certData);

    return new Response(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="performance-certificate-${certData.kpiName.replace(/\s+/g, "-").toLowerCase()}-${timeframe}.png"`,
      },
    });
  } catch (error) {
    console.error("GET /api/performance/certificate error:", error);
    return errorResponse(500, "Failed to generate certificate.");
  }
}

function computeCertDataForKpi(data: Awaited<ReturnType<typeof performanceDashboardService.getData>>, kpiId: string, timeframe: string): PerformanceCertData {
  const kpi = data.kpis.find((k) => k.id === kpiId);
  if (!kpi) throw new Error("KPI not found");

  const unitDirection = kpi.sortOrder === "asc" ? ("Higher" as const) : ("Lower" as const);
  let unit = "";
  if (kpi.type === "percentage") {
    unit = "%";
  } else if (kpi.type === "scoreOutOf" && kpi.maxValue !== null) {
    unit = ` / ${Number(kpi.maxValue).toFixed(0)}`;
  }

  const kpiLogs = data.logs
    .filter((log) => log.kpiId === kpiId)
    .filter((log) => isLogInTimeframe(log.loggedAt, timeframe));

  const userScores: Record<string, { sum: number; count: number; name: string }> = {};
  for (const log of kpiLogs) {
    if (!log.userId) continue;
    if (!userScores[log.userId]) {
      const user = data.users.find((u) => u.id === log.userId);
      userScores[log.userId] = { sum: 0, count: 0, name: user?.name || "Unknown" };
    }
    userScores[log.userId].sum += Number(log.value);
    userScores[log.userId].count += 1;
  }

  const entries = Object.entries(userScores)
    .map(([, d]) => ({ name: d.name, score: d.count > 0 ? d.sum / d.count : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry, index) => ({
      rank: (["1st", "2nd", "3rd", "4th", "5th"][index]) as "1st" | "2nd" | "3rd" | "4th" | "5th",
      name: entry.name,
      score: formatScore(kpi, entry.score),
    }));

  return {
    kpiName: kpi.name,
    unitDirection,
    entries,
  };
}

function isLogInTimeframe(dateStr: string, timeframe: string): boolean {
  const logDate = new Date(dateStr);
  const now = new Date();
  switch (timeframe) {
    case "thisWeek": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return logDate >= start;
    }
    case "thisMonth":
      return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
    case "last6weeks": {
      const windowStart = new Date(now);
      windowStart.setDate(now.getDate() - 42);
      windowStart.setHours(0, 0, 0, 0);
      return logDate >= windowStart && logDate <= now;
    }
    case "allTime":
      return true;
    default:
      return true;
  }
}

function formatScore(kpi: { type: "number" | "percentage" | "scoreOutOf"; maxValue: any }, score: number): string {
  if (kpi.type === "scoreOutOf" && kpi.maxValue !== null) {
    return `${score.toFixed(2)} / ${Math.round(Number(kpi.maxValue)).toString()}`;
  }
  if (kpi.type === "percentage") {
    return `${score.toFixed(2)}%`;
  }
  return score.toLocaleString();
}
