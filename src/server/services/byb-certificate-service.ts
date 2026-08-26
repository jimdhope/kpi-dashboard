import "server-only";

import { readFileSync } from "fs";
import { join } from "path";
import { format } from "date-fns";
import { Competition } from "@prisma/client";
import type { BybStanding } from "@/server/services/beat-your-best";

// ── API ──────────────────────────────────────────────────────────────────────

export interface BybCertData {
  agentName: string;
  rawPoints: number;
  rollingBest: number;
  ratio: number;
  competitionName: string;
  dateRange: string;
  certType: "personal-best" | "top-improvement";
}

export function getCertSubtitle(certType: BybCertData["certType"]): string {
  return certType === "personal-best" ? "PERSONAL BEST UNLOCKED" : "TOP IMPROVEMENT";
}

export function getImprovementValue(ratio: number): number {
  return ratio - 100;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Fill the SVG template (exact copy of the user's design) with live values.
 * Placeholder tokens: {{AGENT_NAME}} {{SUBTITLE}} {{RATIO_PCT}}
 * {{THIS_WEEK}} {{IMPROVEMENT}} {{PREVIOUS_BEST}} {{DATE_RANGE}}
 */
export function renderBybCertificateSvg(data: BybCertData): string {
  const templatePath = join(
    process.cwd(),
    "src/server/services/templates/byb-certificate.svg.tpl",
  );
  const template = readFileSync(templatePath, "utf8");

  const subtitle = getCertSubtitle(data.certType);
  const improvement = getImprovementValue(data.ratio);
  const ratioStr = `${data.ratio.toFixed(1)}%`;
  const improvementStr =
    improvement >= 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`;

  return template
    .replace(/\{\{AGENT_NAME\}\}/g, escapeXml(data.agentName))
    .replace(/\{\{SUBTITLE\}\}/g, escapeXml(subtitle))
    .replace(/\{\{RATIO_PCT\}\}/g, escapeXml(ratioStr))
    .replace(/\{\{THIS_WEEK\}\}/g, escapeXml(data.rawPoints.toLocaleString()))
    .replace(/\{\{IMPROVEMENT\}\}/g, escapeXml(improvementStr))
    .replace(/\{\{PREVIOUS_BEST\}\}/g, escapeXml(data.rollingBest.toLocaleString()))
    .replace(/\{\{DATE_RANGE\}\}/g, escapeXml(data.dateRange));
}

/**
 * Derive cert data from a standing + competition info.
 */
export function standingToCertData(
  standing: BybStanding,
  competition: Pick<Competition, "name" | "startsAt" | "endsAt">,
  certType: BybCertData["certType"],
): BybCertData {
  const dateRange = formatDateRange(competition.startsAt, competition.endsAt);
  return {
    agentName: standing.name,
    rawPoints: standing.rawPoints,
    rollingBest: standing.rollingBest ?? 0,
    ratio: standing.ratio ?? 0,
    competitionName: competition.name,
    dateRange,
    certType,
  };
}

function formatDateRange(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
): string {
  if (!startsAt || !endsAt) return "Competition Week";
  const sameMonth = format(startsAt, "MMM") === format(endsAt, "MMM");
  if (sameMonth) {
    return `${format(startsAt, "MMM d")} – ${format(endsAt, "d, yyyy")}`;
  }
  return `${format(startsAt, "MMM d")} – ${format(endsAt, "MMM d, yyyy")}`;
}
