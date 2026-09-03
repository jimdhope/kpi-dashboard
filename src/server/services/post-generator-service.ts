import "server-only";

import { prisma } from "@/server/db/client";
import type { Prisma } from "@prisma/client";
import { scoreEventProjectionService } from "@/server/services/score-event-projection-service";

export interface PostGeneratorSection {
  name: string;
  wordCount: number;
  content: string;
  enabled: boolean;
}

export interface PostGeneratorTemplate {
  sections: PostGeneratorSection[];
}

export interface PostGeneratorSettings {
  apiKey: string | null;
  veTemplate: PostGeneratorTemplate;
  teamsTemplate: PostGeneratorTemplate;
}

const API_KEY_SETTING_KEY = "postGenerator.openrouterApiKey";
const VE_TEMPLATE_SETTING_KEY = "postGenerator.veTemplate";
const TEAMS_TEMPLATE_SETTING_KEY = "postGenerator.teamsTemplate";

export const DEFAULT_SECTIONS: PostGeneratorSection[] = [
  { name: "Introduction", wordCount: 80, content: "", enabled: true },
  { name: "Scores & Winners", wordCount: 100, content: "", enabled: true },
  { name: "New Theme & Teams", wordCount: 80, content: "", enabled: true },
  { name: "Pep Talk & Teamwork", wordCount: 80, content: "", enabled: true },
  { name: "Conclusion", wordCount: 40, content: "", enabled: true },
];

const DEFAULT_TEMPLATE: PostGeneratorTemplate = { sections: DEFAULT_SECTIONS };

function parseTemplate(value: unknown): PostGeneratorTemplate {
  if (!value || typeof value !== "object") return DEFAULT_TEMPLATE;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) return DEFAULT_TEMPLATE;
  return {
    sections: obj.sections.map((s: Record<string, unknown>) => ({
      name: typeof s.name === "string" ? s.name : "",
      wordCount: typeof s.wordCount === "number" ? s.wordCount : 80,
      content: typeof s.content === "string" ? s.content : "",
      enabled: typeof s.enabled === "boolean" ? s.enabled : true,
    })),
  };
}

function parseApiKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return typeof obj.apiKey === "string" ? obj.apiKey : null;
}

export const postGeneratorService = {
  async getApiKey(): Promise<string | null> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: API_KEY_SETTING_KEY },
      select: { value: true },
    });
    return parseApiKey(setting?.value);
  },

  async saveApiKey(apiKey: string): Promise<void> {
    const value = { apiKey } as unknown as Prisma.InputJsonValue;
    await prisma.appSetting.upsert({
      where: { key: API_KEY_SETTING_KEY },
      update: { value },
      create: { key: API_KEY_SETTING_KEY, value },
    });
  },

  async getTemplate(type: "ve" | "teams"): Promise<PostGeneratorTemplate> {
    const key = type === "ve" ? VE_TEMPLATE_SETTING_KEY : TEAMS_TEMPLATE_SETTING_KEY;
    const setting = await prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return parseTemplate(setting?.value);
  },

  async saveTemplate(type: "ve" | "teams", sections: PostGeneratorSection[]): Promise<void> {
    const key = type === "ve" ? VE_TEMPLATE_SETTING_KEY : TEAMS_TEMPLATE_SETTING_KEY;
    const value = { sections } as unknown as Prisma.InputJsonValue;
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  async getSettings(): Promise<PostGeneratorSettings> {
    const [apiKey, veTemplate, teamsTemplate] = await Promise.all([
      this.getApiKey(),
      this.getTemplate("ve"),
      this.getTemplate("teams"),
    ]);
    return { apiKey, veTemplate, teamsTemplate };
  },

  async resolveCompetitionData(competitionId: string) {
    const standings = await scoreEventProjectionService.getCompetitionStandings({
      competitionId,
    });
    const top = standings.slice(0, 3);
    return {
      top,
      total: standings.length,
    };
  },
};
