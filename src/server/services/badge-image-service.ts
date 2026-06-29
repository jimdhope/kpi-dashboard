import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "badges", "templates");

const templateAliases: Record<string, string> = {
  streak_3: "streak",
  streak_5: "streak",
  streak_10: "streak",
};

function resolveTemplatePath(badgeKey: string): string {
  const resolvedKey = templateAliases[badgeKey] ?? badgeKey;
  const svgFileName = `${resolvedKey}.svg`;
  const fullPath = path.join(TEMPLATES_DIR, svgFileName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  throw new Error(`Badge template not found: ${svgFileName} (resolved from ${badgeKey})`);
}

export const badgeImageService = {
  async generateBadgeImage(params: {
    badgeKey: string;
    agentName: string;
    variables: Record<string, string>;
  }): Promise<Uint8Array> {
    const templatePath = resolveTemplatePath(params.badgeKey);
    let svg = fs.readFileSync(templatePath, "utf-8");

    svg = svg.replace(/\{\{AGENT_NAME\}\}/g, params.agentName);
    for (const [key, value] of Object.entries(params.variables)) {
      svg = svg.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 300 },
    });
    const rendered = resvg.render();
    return new Uint8Array(rendered.asPng());
  },
};
