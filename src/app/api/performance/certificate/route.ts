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

// Replicates the exact dashboard scoring logic from src/app/(app)/performance/page.tsx
function computeCertDataForKpi(
  data: Awaited<ReturnType<typeof performanceDashboardService.getData>>,
  kpiId: string,
  timeframe: string,
): PerformanceCertData {
  const kpi = data.kpis.find((k) => k.id === kpiId);
  if (!kpi) throw new Error("KPI not found");

  const unitDirection = kpi.sortOrder === "asc" ? ("Lower" as const) : ("Higher" as const);

  // ── Filter logs matching dashboard's timeframe window ──────────────────
  const now = new Date();
  let kpiLogs: typeof data.logs;

  switch (timeframe) {
    case "thisWeek": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      kpiLogs = data.logs.filter((log) => log.kpiId === kpiId && new Date(log.loggedAt) >= start);
      break;
    }
    case "thisMonth":
      kpiLogs = data.logs.filter((log) => {
        if (log.kpiId !== kpiId) return false;
        const d = new Date(log.loggedAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      break;
    case "last6weeks": {
      // Mirror dashboard: compute filteredLogs once, then filter by kpiId
      const allLogs = data.logs;
      const maxDates: Record<string, Date> = {};
      for (const log of allLogs) {
        const d = new Date(log.loggedAt);
        if (!maxDates[log.kpiId] || d > maxDates[log.kpiId]) maxDates[log.kpiId] = d;
      }
      const max = maxDates[kpiId];
      if (!max) {
        kpiLogs = [];
      } else {
        const ws = new Date(max);
        ws.setDate(max.getDate() - 42);
        ws.setHours(0, 0, 0, 0);
        kpiLogs = allLogs.filter(
          (log) => log.kpiId === kpiId && (() => { const d = new Date(log.loggedAt); return d >= ws && d <= max; })(),
        );
      }
      break;
    }
    case "allTime":
    default:
      kpiLogs = data.logs.filter((log) => log.kpiId === kpiId);
  }

  // ── Aggregate scores matching dashboard logic ──────────────────────────
  const useWeeklyAvg = timeframe === "last6weeks" && (kpi.type === "percentage" || kpi.type === "scoreOutOf");

  const agentData: Record<string, { sum: number; count: number }> = {};
  for (const log of kpiLogs) {
    if (!log.userId) continue;
    if (!agentData[log.userId]) agentData[log.userId] = { sum: 0, count: 0 };
    agentData[log.userId].sum += Number(log.value);
    agentData[log.userId].count += 1;
  }

  // Dashboard finds max date across ALL KPI logs for weekly windows
  let kpiMaxDate: Date | null = null;
  if (useWeeklyAvg) {
    for (const log of data.logs) {
      const d = new Date(log.loggedAt);
      if (!kpiMaxDate || d > kpiMaxDate) kpiMaxDate = d;
    }
  }

  const agentScores: Record<string, number> = {};
  Object.entries(agentData).forEach(([agentId, ad]) => {
    if (useWeeklyAvg && kpiMaxDate) {
      const agentLogs = kpiLogs.filter((log) => log.userId === agentId);
      const weeklyAvgs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const we = new Date(kpiMaxDate);
        we.setDate(kpiMaxDate.getDate() - i * 7);
        we.setHours(23, 59, 59, 999);
        const ws = new Date(we);
        ws.setDate(we.getDate() - 6);
        ws.setHours(0, 0, 0, 0);
        const wl = agentLogs.filter((log) => {
          const d = new Date(log.loggedAt);
          return d >= ws && d <= we;
        });
        if (wl.length > 0) weeklyAvgs.push(wl.reduce((s, l) => s + Number(l.value), 0) / wl.length);
      }
      agentScores[agentId] = weeklyAvgs.length > 0 ? weeklyAvgs.reduce((s, a) => s + a, 0) / weeklyAvgs.length : 0;
    } else if (kpi.type === "percentage" || kpi.type === "scoreOutOf") {
      agentScores[agentId] = ad.count > 0 ? ad.sum / ad.count : 0;
    } else {
      agentScores[agentId] = ad.sum;
    }
  });

  const entries = Object.entries(agentScores)
    .map(([agentId, score]) => {
      const agent = data.users.find((u) => u.id === agentId);
      return { name: agent?.name || "Unknown", score };
    })
    .sort((a, b) => (unitDirection === "Higher" ? b.score - a.score : a.score - b.score))
    .slice(0, 5)
    .map((entry, index) => ({
      rank: (["1st", "2nd", "3rd", "4th", "5th"][index]) as "1st" | "2nd" | "3rd" | "4th" | "5th",
      name: entry.name.split(" ")[0],
      score: formatScore(kpi, entry.score),
    }));

  return {
    kpiName: kpi.name,
    unitDirection,
    entries,
  };
}

function formatScore(kpi: { type: "number" | "percentage" | "scoreOutOf"; maxValue: unknown }, score: number): string {
  if (kpi.type === "scoreOutOf" && kpi.maxValue !== null) {
    return `${score.toFixed(2)} / ${Math.round(Number(kpi.maxValue)).toString()}`;
  }
  if (kpi.type === "percentage") {
    return `${score.toFixed(2)}%`;
  }
  return score.toLocaleString();
}
