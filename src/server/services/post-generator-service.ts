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

// ─── TipTap JSON helpers ────────────────────────────────────────────────────

function h(level: number, text: string) {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function p(text: string) {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}

function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}

// ─── Default templates ──────────────────────────────────────────────────────

function getDefaultVeSections(): PostGeneratorSection[] {
  return [
    {
      name: "Introduction",
      wordCount: 90,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "{competitionName}"),
        p("It's the end of another {competitionDuration} week and after a week of {{something relating to the competition name and teams}}, it's time to reveal the results of our {competitionName} competition."),
        p("{{comments on this week's competition without giving any scores or winner's away... closeness of the scores, fun had, that kind of thing}}"),
        p("{{segue to next section}}")
      )),
    },
    {
      name: "Scores & Winners",
      wordCount: 110,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🏆 {competitionName} RESULTS 🏆"),
        p("After a week of {{word related to competition}} performances, one team managed to rally together and {{something descriptive}} to the top of the leaderboard..."),
        h(3, "🔥 Winning Team: {winningTeamName}"),
        p("👏 {winningTeamMembers}"),
        p("{winningTeamName} united in pursuit of victory and ultimately emerged triumphant. A huge congratulations to all! 🎉"),
        h(3, "🌟 TOP PERFORMERS OF THE WEEK 🌟"),
        p("🥇 1st Place – {topPerformer1Name}"),
        p("🥈 2nd Place – {topPerformer2Name}"),
        p("🥉 3rd Place – {topPerformer3Name}"),
        p("A massive congratulations to all three! 👏")
      )),
    },
    {
      name: "New Theme & Teams",
      wordCount: 90,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "{{Relevant Emojis}} THIS WEEK: {nextWeekCompetitionName}! {{Relevant Emojis}}"),
        p("{{description of previous comp ending in three-part 'the thing has stopped, the thing has ended, the thing is complete' type of thing, but not that style of wording}}"),
        p("{nextWeekTheme}!"),
        p("This week we're celebrating {nextWeekCompetitionName}, and three deliciously competitive teams are preparing to battle it out for leaderboard glory. Taking to the griddle this week are:"),
        p("{{Team 1 Emoji}} {{Team 1 Name}}"),
        p("{{Team 2 Emoji}} {{Team 2 Name}}"),
        p("{{Team 3 Emoji}} {{Team 3 Name}}"),
        p("Who will {{something to do with the theme}}? Who will {{something to do with the theme}}? And who will be celebrating victory this time next week? Only time will tell...")
      )),
    },
    {
      name: "Pep Talk & Teamwork",
      wordCount: 80,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "💙 CELEBRATING TEAMWORK 💙"),
        p("{{mini speech about celebrating wins as a team and encouraging work as not only mini teams in the competition but a team as a whole}}")
      )),
    },
    {
      name: "Conclusion",
      wordCount: 45,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🚀 A NEW WEEK BEGINS"),
        p("{{The leaderboard has been reset. The competition is ready. And another opportunity awaits. type thing}}"),
        p("{{Congratulations once again to our winners! Good luck to everyone taking part this week. type thing}}"),
        p("{{old Competition Relevant emojis}} {{Let's make it another fantastic week! type thing}} {{new competition relevant emojis}}")
      )),
    },
  ];
}

function getDefaultTeamsSections(): PostGeneratorSection[] {
  return [
    {
      name: "Introduction",
      wordCount: 80,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "{competitionName}"),
        p("It's the end of another {competitionDuration} week and after a week of {{something relating to the competition name and teams}}, it's time to reveal the results of our {competitionName} competition."),
        p("{{comments on this week's competition without giving any scores or winner's away... closeness of the scores, fun had, that kind of thing}}"),
        p("{{segue to next section}}")
      )),
    },
    {
      name: "Scores & Winners",
      wordCount: 120,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🏆 {competitionName} RESULTS 🏆"),
        p("After a week of {{word related to competition}} performances, one team managed to rally together and {{something descriptive}} to the top of the leaderboard..."),
        h(3, "🔥 Winning Team: {winningTeamName}"),
        p("👏 {winningTeamMembers}"),
        p("{winningTeamName} united in pursuit of victory and ultimately emerged triumphant. A huge congratulations to all! 🎉"),
        h(3, "🌟 TOP PERFORMERS OF THE WEEK 🌟"),
        p("🥇 1st Place – {topPerformer1Name}"),
        p("🥈 2nd Place – {topPerformer2Name}"),
        p("🥉 3rd Place – {topPerformer3Name}"),
        p("A massive congratulations to all three! 👏")
      )),
    },
    {
      name: "New Theme & Teams",
      wordCount: 100,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "{{Relevant Emojis}} THIS WEEK: {nextWeekCompetitionName}! {{Relevant Emojis}}"),
        p("{{description of previous comp ending in three-part 'the thing has stopped, the thing has ended, the thing is complete' type of thing, but not that style of wording}}"),
        p("{nextWeekTheme}!"),
        p("This week we're celebrating {nextWeekCompetitionName}, and three deliciously competitive teams are preparing to battle it out for leaderboard glory. Taking to the griddle this week are:"),
        p("{{Team 1 Emoji}} {{Team 1 Name}}"),
        p("{{Team 2 Emoji}} {{Team 2 Name}}"),
        p("{{Team 3 Emoji}} {{Team 3 Name}}"),
        p("Who will {{something to do with the theme}}? Who will {{something to do with the theme}}? And who will be celebrating victory this time next week? Only time will tell...")
      )),
    },
    {
      name: "Pep Talk & Teamwork",
      wordCount: 60,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "💙 CELEBRATING TEAMWORK 💙"),
        p("{{mini speech about celebrating wins as a team and encouraging work as not only mini teams in the competition but a team as a whole}}")
      )),
    },
    {
      name: "Conclusion",
      wordCount: 40,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🚀 A NEW WEEK BEGINS"),
        p("{{The leaderboard has been reset. The competition is ready. And another opportunity awaits. type thing}}"),
        p("{{Congratulations once again to our winners! Good luck to everyone taking part this week. type thing}}"),
        p("{{old Competition Relevant emojis}} {{Let's make it another fantastic week! type thing}} {{new competition relevant emojis}}")
      )),
    },
  ];
}

const DEFAULT_VE_TEMPLATE: PostGeneratorTemplate = { sections: getDefaultVeSections() };
const DEFAULT_TEAMS_TEMPLATE: PostGeneratorTemplate = { sections: getDefaultTeamsSections() };

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseTemplate(value: unknown): PostGeneratorTemplate {
  if (!value || typeof value !== "object") return DEFAULT_VE_TEMPLATE;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.sections)) return DEFAULT_VE_TEMPLATE;
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

// ─── Service ────────────────────────────────────────────────────────────────

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
