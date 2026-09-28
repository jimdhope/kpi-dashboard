import { performanceDashboardService } from "@/server/services/performance-dashboard-service";
import { renderPerformanceCertificatePng, type PerformanceCertData } from "@/server/services/performance-certificate-service";
import {
  buildKpiLeaderboards,
  formatDownloadScore,
  normalizeKpiMaxValue,
  normalizeTimeframe,
  type PerformanceTimeframe,
  type ScoringKpi,
} from "@/lib/performance-scoring";
import { errorResponse } from "@/server/http";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver");

const RANK_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"] as const;
type CertRank = (typeof RANK_ORDINALS)[number];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kpiId = searchParams.get("kpiId");
    const all = searchParams.get("all") === "true";
    const timeframe: PerformanceTimeframe = normalizeTimeframe(searchParams.get("timeframe"));
    const podId = searchParams.get("podId") || undefined;

    const dashboardData = await performanceDashboardService.getData(podId);
    const certificates = buildCertificateData(dashboardData, timeframe);

    if (all) {
      const zip = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        zip.on("data", (chunk: Buffer) => chunks.push(chunk));
        zip.on("error", reject);
        zip.on("end", resolve);

        Promise.all(
          dashboardData.kpis.map(async (kpi) => {
            const certData = certificates.get(kpi.id);
            if (!certData) return;
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

    const certData = certificates.get(kpiId);
    if (!certData) {
      return errorResponse(404, "KPI not found");
    }

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

/**
 * Ranks the same leaderboards the dashboard renders, using the shared scoring
 * module, so a certificate can never disagree with the score on screen.
 */
function buildCertificateData(
  data: Awaited<ReturnType<typeof performanceDashboardService.getData>>,
  timeframe: PerformanceTimeframe,
): Map<string, PerformanceCertData> {
  // `maxValue` is a Prisma Decimal here but a JSON string on the client, so
  // normalise it to the plain shape the shared scoring module expects.
  const kpis: ScoringKpi[] = data.kpis.map((kpi) => ({
    id: kpi.id,
    name: kpi.name,
    initials: kpi.initials,
    type: kpi.type,
    maxValue: kpi.maxValue === null ? null : normalizeKpiMaxValue(String(kpi.maxValue)),
    sortOrder: kpi.sortOrder,
  }));

  const leaderboards = buildKpiLeaderboards({
    kpis,
    logs: data.logs,
    users: data.users,
    timeframe,
  });

  return new Map(
    leaderboards.map(({ kpi, entries }) => [
      kpi.id,
      {
        kpiName: kpi.name,
        unitDirection: kpi.sortOrder === "asc" ? "Lower" : "Higher",
        entries: entries.map((entry) => ({
          rank: (RANK_ORDINALS[entry.rank - 1] ?? `${entry.rank}th`) as CertRank,
          name: entry.agentName.split(" ")[0],
          score: formatDownloadScore(kpi, entry.score),
        })),
      } satisfies PerformanceCertData,
    ]),
  );
}
