import { beatYourBestService } from "@/server/services/beat-your-best-service";
import {
  renderBybCertificateSvg,
  standingToCertData,
  type BybCertData,
} from "@/server/services/byb-certificate-service";
import sharp from "sharp";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { competitionRepository } from "@/server/repositories/competition-repository";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

function getQuery(req: Request): Record<string, string | null> {
  const url = new URL(req.url);
  return {
    agentId: url.searchParams.get("agentId"),
    certType: url.searchParams.get("certType"),
    name: url.searchParams.get("name"),
    format: url.searchParams.get("format"),
  };
}

export async function GET(request: Request) {
  try {
    const { agentId, certType, name: nameParam, format } = getQuery(request);
    const wantPng = format === "png";

    if (!agentId) {
      return errorResponse(400, "agentId is required");
    }
    if (!certType || !["personal-best", "top-improvement"].includes(certType)) {
      return errorResponse(400, "certType must be 'personal-best' or 'top-improvement'");
    }

    const user = await authService.getCurrentSession();
    const isAdmin =
      user?.user?.roles?.includes("admin") ||
      (await permissionService.hasNavAccess(user?.user?.roles ?? [], "competitions", "MANAGE"));

    // Only admins can fetch certs for other agents; agents can only fetch their own
    if (!isAdmin && user?.user?.id !== agentId) {
      return errorResponse(403, "You can only generate certificates for yourself");
    }

    // Get the competition ID from the route params
    const pathname = new URL(request.url).pathname;
    const pathParts = pathname.split("/");
    const competitionId = pathParts[pathParts.indexOf("competitions") + 1];

    if (!competitionId) {
      return errorResponse(400, "Competition ID not found in path");
    }

    // Fetch standings (cached) and competition info
    const standings = await beatYourBestService.getStandings(competitionId);
    const competition = await competitionRepository.findById(competitionId);

    if (!competition) {
      return errorResponse(404, "Competition not found");
    }

    // Find the standing for this agent
    const standing = standings.standings.find((s) => s.userId === agentId);
    if (!standing) {
      return errorResponse(404, "Agent not found in standings for this competition");
    }

    // Validate cert type eligibility
    if (certType === "personal-best") {
      if (!standing.ranked || standing.rawPoints <= (standing.rollingBest ?? 0)) {
        return errorResponse(400, "This agent has not broken their personal best this week");
      }
    } else if (certType === "top-improvement") {
      const ranked = standings.standings.filter((s) => s.ranked);
      if (ranked.length === 0) {
        return errorResponse(400, "No ranked players to determine a top improver");
      }
      const topImprover = [...ranked].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))[0];
      if (!topImprover || topImprover.userId !== agentId) {
        return errorResponse(400, "This agent is not the top improver (highest % of personal best) this week");
      }
    }

    const certData: BybCertData = standingToCertData(
      standing,
      { name: competition.name, startsAt: competition.startsAt, endsAt: competition.endsAt },
      certType as BybCertData["certType"],
    );

    const svg = renderBybCertificateSvg(certData);
    const baseName = `byb-${certType}-${encodeURIComponent(certData.agentName)}`;

    if (wantPng) {
      const png = await sharp(Buffer.from(svg), { density: 96 })
        .resize(1600, 1000)
        .png()
        .toBuffer();
      return new Response(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${baseName}.png"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("BYB certificate error:", error);
    return errorResponse(500, "Failed to generate certificate");
  }
}
