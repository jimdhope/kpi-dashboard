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
    const timeframe: PerformanceTimeframe = normalizeTimeframe(searchParams.get("timeframe"));
    const podId = searchParams.get("podId") || undefined;

    const dashboardData = await performanceDashboardService.getData(podId);
    const files = buildCertificateFiles(dashboardData, timeframe);

    const zip = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      zip.on("data", (chunk: Buffer) => chunks.push(chunk));
      zip.on("error", reject);
      zip.on("end", resolve);

      Promise.all(
        files.map(async ({ filename, certData }) => {
          const png = await renderPerformanceCertificatePng(certData);
          zip.append(png, { name: filename });
        }),
      ).then(() => zip.finalize());
    });

    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="performance-certificates-${timeframe}.zip"`,
      },
    });
  } catch (error) {
    console.error("GET /api/performance/certificate error:", error);
    return errorResponse(500, "Failed to generate certificates.");
  }
}

/** KPI names can carry stray whitespace, so trim before slugging. */
function slugify(value: string): string {
  return value.trim().replace(/\s+/g, "-").toLowerCase();
}

/**
 * Ranks the same leaderboards the dashboard renders, using the shared scoring
 * module, so a certificate can never disagree with the score on screen.
 */
function buildCertificateFiles(
  data: Awaited<ReturnType<typeof performanceDashboardService.getData>>,
  timeframe: PerformanceTimeframe,
): { filename: string; certData: PerformanceCertData }[] {
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

  return leaderboards.map(({ kpi, entries }) => ({
    filename: `performance-certificate-${kpi.initials || slugify(kpi.name)}-${timeframe}.png`,
    certData: {
      kpiName: kpi.name,
      unitDirection: kpi.sortOrder === "asc" ? "Lower" : "Higher",
      entries: entries.map((entry) => ({
        rank: (RANK_ORDINALS[entry.rank - 1] ?? `${entry.rank}th`) as CertRank,
        name: entry.agentName.split(" ")[0],
        score: formatDownloadScore(kpi, entry.score),
      })),
    },
  }));
}
