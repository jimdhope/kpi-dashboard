import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export interface PerformanceCertData {
  kpiName: string;
  unitDirection: "Higher" | "Lower";
  entries: {
    rank: "1st" | "2nd" | "3rd" | "4th" | "5th";
    name: string;
    score: string;
  }[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const TEMPLATE_PATH = join(process.cwd(), "src/server/services/templates/performance-certificate.svg.tpl");

function loadTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf-8");
}

export function renderPerformanceCertificateSvg(data: PerformanceCertData): string {
  let svg = loadTemplate();

  svg = svg.replace(/\{\{KPI_NAME\}\}/g, escapeXml(data.kpiName));
  svg = svg.replace(/\{\{UNIT_DIRECTION\}\}/g, data.unitDirection);

  for (const entry of data.entries) {
    const rankUpper = entry.rank.toUpperCase();
    svg = svg.replace(new RegExp(`\\{\\{SCORE_${rankUpper}\\}\\}`, "g"), entry.score);
    svg = svg.replace(new RegExp(`\\{\\{NAME_${rankUpper}\\}\\}`, "g"), entry.name || "");
  }

  return svg;
}

export async function renderPerformanceCertificatePng(data: PerformanceCertData): Promise<Buffer> {
  const svg = renderPerformanceCertificateSvg(data);
  return sharp(Buffer.from(svg)).png().toBuffer();
}