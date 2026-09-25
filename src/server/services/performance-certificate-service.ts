import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PerformanceCertData {
  kpiName: string;
  unitDirection: "Higher" | "Lower";
  unit: string;
  entries: {
    rank: "1st" | "2nd" | "3rd" | "4th" | "5th";
    name: string;
    score: string;
  }[];
}

export function renderPerformanceCertificateSvg(data: PerformanceCertData): string {
  const templatePath = join(process.cwd(), "src/server/services/templates/performance-certificate.svg.tpl");
  const template = readFileSync(templatePath, "utf8");

  const replacements: Record<string, string> = {
    "{{KPI_NAME}}": escapeXml(data.kpiName),
    "{{UNIT_DIRECTION}}": data.unitDirection,
    "{{UNIT}}": data.unit,
  };

  for (const entry of data.entries) {
    const rankUpper = entry.rank.toUpperCase();
    replacements[`{{SCORE_${rankUpper}}}`] = escapeXml(entry.score);
    replacements[`{{NAME_${rankUpper}}}`] = escapeXml(entry.name);
  }

  let svg = template;
  for (const [key, value] of Object.entries(replacements)) {
    svg = svg.replace(new RegExp(key, "g"), value);
  }
  return svg;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
