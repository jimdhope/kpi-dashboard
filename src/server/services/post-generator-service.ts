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

function bold(text: string) {
  return { type: "text", text, marks: [{ type: "bold" }] };
}

function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}

// ─── Default templates based on Frankenstein Week post ─────────────────────

function getDefaultVeSections(): PostGeneratorSection[] {
  return [
    {
      name: "Introduction",
      wordCount: 90,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "⚡🧪 {competitionName}! 🥓🔥"),
        p("Good afternoon everyone,"),
        p("Another {competitionDuration} week has come to an end, and after a week of experiments, monsters, lightning strikes, and suspicious laboratory activity, it's time to reveal the results of our {competitionName} competition."),
        p("The race for the top spot couldn't have been much closer. Every team put in an incredible effort, with just 12 points separating first place from third place, proving that every contribution really did matter this week."),
        p("So, let's see who brought their creation to life and claimed victory... ⚡")
      )),
    },
    {
      name: "Scores & Winners",
      wordCount: 110,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🏆 {competitionName} RESULTS 🏆"),
        p("After a week of electrifying performances, one team managed to rally together and storm their way to the top of the leaderboard..."),
        h(3, "🔥 Winning Team: {winningTeamName}"),
        p("👏 {winningTeamMembers}"),
        p("With an impressive {winningTeamScore} points, {winningTeamName} united in pursuit of victory and ultimately emerged triumphant."),
        p("A huge congratulations to all! 🎉"),
        h(3, "🌟 TOP PERFORMERS OF THE WEEK 🌟"),
        p("🥇 1st Place – {topPerformer1Name} ({topPerformer1Score} points)"),
        p("🥈 2nd Place – {topPerformer2Name} ({topPerformer2Score} points)"),
        p("🥉 3rd Place – {topPerformer3Name} ({topPerformer3Score} points)"),
        p("A massive congratulations to all three! 👏")
      )),
    },
    {
      name: "New Theme & Teams",
      wordCount: 90,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🥓🔥 THIS WEEK: {nextWeekCompetitionName}! 🔥🥓"),
        p("The laboratory has been shut down. The villagers have returned home. And now it's time for something much more important..."),
        p("{nextWeekTheme}!"),
        p("This week we're celebrating {nextWeekCompetitionName}, and three deliciously competitive teams are preparing to battle it out for leaderboard glory. Taking to the griddle this week are:"),
        p("🥓 The Sizzle Squad"),
        p("🥓 Bringin' Home the Bacon"),
        p("🥓 Don't Go Bacon My Heart"),
        p("Who will bring the heat? Who will serve up the strongest performances? And who will be celebrating victory this time next week? Only time will tell...")
      )),
    },
    {
      name: "Pep Talk & Teamwork",
      wordCount: 80,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "💙 CELEBRATING TEAMWORK 💙"),
        p("While we celebrate our winners, it's important to recognise the wider team effort behind every competition."),
        p("Week after week, it's inspiring to see colleagues supporting one another, sharing successes, encouraging improvement, and helping create a positive environment where everyone can thrive."),
        p("Whether you topped the leaderboard, improved your score, or helped support your teammates along the way, you've played a part in another successful week."),
        p("Thank you all for your contribution. 👏")
      )),
    },
    {
      name: "Conclusion",
      wordCount: 45,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🚀 A NEW WEEK BEGINS"),
        p("The leaderboard has been reset. The competition is ready. And another opportunity awaits."),
        p("Congratulations once again to our winners! Good luck to everyone taking part this week."),
        p("🥓🔥 Let's make it another fantastic week! 🔥🥓")
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
        h(2, "🥓🔥 TEAM HARVEY – {competitionName} RESULTS 🔥🥓"),
        p("📢 Attention Team Harvey!"),
        p("The laboratory has been powered down. The monsters have wandered off. The torches and pitchforks have been returned to storage. And now it's time to reveal the results of {competitionName} before we fire up the grill for our tastiest competition yet! 😋")
      )),
    },
    {
      name: "Scores & Winners",
      wordCount: 120,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "⚡🏆 {competitionName} RESULTS 🏆⚡"),
        h(3, "📊 LEADERBOARD"),
        p("[INSERT LEADERBOARD HERE]"),
        p("What a close competition! Only 12 points separated first and third place, proving that every score mattered this week."),
        h(3, "🔥 {winningTeamName} 🔥"),
        p("👏 {winningTeamMembers}"),
        p("Despite being the smallest team, {winningTeamName} showed that quality beats quantity. They claimed the top spot with an impressive {winningTeamScore} points. A huge congratulations! 🎉🏆"),
        h(3, "🌟 THIS WEEK'S TOP PERFORMERS 🌟"),
        p("🥇 {topPerformer1Name} – {topPerformer1Score} Points"),
        p("🥈 {topPerformer2Name} – {topPerformer2Score} Points"),
        p("🥉 {topPerformer3Name} – {topPerformer3Score} Points"),
        p("Fantastic work! 👏👏👏")
      )),
    },
    {
      name: "New Theme & Teams",
      wordCount: 100,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🚀 BEAT YOUR BEST CHAMPION 🚀"),
        p("The Beat Your Best Champion isn't about beating everyone else. It's about beating yourself. And this week's winner absolutely smashed it!"),
        p("🏆 {bybChampionName} achieved an incredible {bybChampionScore}% of her rolling 8-week best score! 🎉"),
        h(3, "📈 PERSONAL BEST ACHIEVERS 📈"),
        p("A special shout-out to this week's personal best breakers:"),
        p("🌟 {pbBreakers}"),
        p("It takes real effort to improve upon your own best, so a huge congratulations to both of you! 👏🔥"),
        h(2, "🥓🥪 {nextWeekCompetitionName} HAS ARRIVED! 🥪🥓"),
        p("Three teams enter. One team leaves with bragging rights."),
        p("🥓 TEAM 1 – Description"),
        p("🥓 TEAM 2 – Description"),
        p("🥓 TEAM 3 – Description")
      )),
    },
    {
      name: "Pep Talk & Teamwork",
      wordCount: 60,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "💙 SHARE THE LOVE 💙"),
        p("Don't forget to jump onto Viva Engage:"),
        p("🏆 Download your certificates"),
        p("👏 Celebrate the winners"),
        p("🎉 Congratulate your teammates"),
        p("💙 Share some Team Harvey love"),
        p("A little recognition goes a long way!")
      )),
    },
    {
      name: "Conclusion",
      wordCount: 40,
      enabled: true,
      content: JSON.stringify(doc(
        h(2, "🚨 FINAL QUESTION 🚨"),
        p("The grill is hot. The leaderboard is reset. The bacon is sizzling."),
        p("The only question left is... 🥓 WHO'S GOING TO BRING HOME THE BACON? 🥓"),
        p("Good luck everyone! Let's make it another fantastic week! 🔥🏆😄")
      )),
    },
  ];
}

export const DEFAULT_SECTIONS = getDefaultVeSections();

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
