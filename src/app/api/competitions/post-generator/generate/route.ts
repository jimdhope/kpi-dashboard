import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { authService } from "@/server/services/auth-service";
import { requireResourceAccess } from "@/server/services/authorization";
import { postGeneratorService } from "@/server/services/post-generator-service";
import { generatePosts, OpenRouterError } from "@/server/services/openrouter-service";

const generateSchema = z.object({
  type: z.enum(["basic", "byb", "league"]),
  thisWeekCompetitionId: z.string().min(1),
  nextWeekCompetitionId: z.string().nullable().optional(),
  theme: z.string().min(1, "Theme is required"),
});

function sectionContentToMarkdown(content: string): string {
  if (!content) return "";
  try {
    const json = JSON.parse(content);
    // TipTap/ProseMirror JSON → markdown: extract text from doc nodes
    if (json.type === "doc" && Array.isArray(json.content)) {
      return json.content.map((node: any) => {
        if (node.type === "paragraph") {
          return (node.content || []).map((c: any) => c.text || "").join("");
        }
        if (node.type === "heading") {
          const level = node.attrs?.level || 1;
          const text = (node.content || []).map((c: any) => c.text || "").join("");
          return `${"#".repeat(level)} ${text}`;
        }
        if (node.type === "bulletList" || node.type === "orderedList") {
          return (node.content || [])
            .map((item: any) => {
              const text = (item.content || [])
                .map((c: any) => (c.content || []).map((cc: any) => cc.text || "").join(""))
                .join("");
              return `- ${text}`;
            })
            .join("\n");
        }
        return "";
      }).join("\n\n");
    }
    return content;
  } catch {
    return content;
  }
}

function replaceTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => tokens[key] ?? match);
}

function buildPrompt(
  sections: Array<{ name: string; wordCount: number; content: string; enabled: boolean }>,
  tokens: Record<string, string>
): string {
  const parts = sections
    .filter((s) => s.enabled)
    .map((s) => {
      const content = replaceTokens(sectionContentToMarkdown(s.content), tokens);
      return `## ${s.name} (~${s.wordCount} words)\n${content}`;
    });
  return parts.join("\n\n");
}

export async function POST(request: Request) {
  try {
    await authService.requireCurrentUser();
    await requireResourceAccess("nav.competitions.postGenerator", "VIEW");

    const body = await request.json();
    const parsed = generateSchema.parse(body);

    // Read API key
    const apiKey = await postGeneratorService.getApiKey();
    if (!apiKey) {
      return errorResponse(400, "OpenRouter API key not configured. Please set it in Settings → Post Generator.");
    }

    // Fetch this week's competition
    const thisWeek = await prisma.competition.findUnique({
      where: { id: parsed.thisWeekCompetitionId },
      include: {
        teams: true,
        entries: { include: { user: true } },
      },
    });
    if (!thisWeek) {
      return errorResponse(404, "This week's competition not found.");
    }

    // Fetch next week's competition (optional)
    const nextWeek = parsed.nextWeekCompetitionId
      ? await prisma.competition.findUnique({ where: { id: parsed.nextWeekCompetitionId } })
      : null;

    // Resolve standings from score-event projection
    const standings = await postGeneratorService.resolveCompetitionData(thisWeek.id);
    const top = standings.top;

    // Fetch winning team members
    const winningTeam = thisWeek.teams[0];
    const winningTeamMembers = winningTeam?.agentIds?.length
      ? await prisma.user.findMany({
          where: { id: { in: winningTeam.agentIds } },
          select: { name: true },
        })
      : [];

    // Build tokens
    const tokens: Record<string, string> = {
      competitionName: thisWeek.name,
      competitionDescription: thisWeek.description || "",
      competitionDuration: formatDuration(thisWeek.startsAt, thisWeek.endsAt),
      totalCompetitors: String(standings.total),
      winningTeamName: winningTeam?.name || "",
      winningTeamMembers: winningTeamMembers.map((m) => m.name).join(", "),
      winningTeamScore: top[0] ? String(top[0].points) : "",
      topPerformer1Name: top[0]?.agentName || "",
      topPerformer1Score: top[0] ? String(top[0].points) : "",
      topPerformer2Name: top[1]?.agentName || "",
      topPerformer2Score: top[1] ? String(top[1].points) : "",
      topPerformer3Name: top[2]?.agentName || "",
      topPerformer3Score: top[2] ? String(top[2].points) : "",
      nextWeekCompetitionName: nextWeek?.name || "",
      nextWeekTheme: parsed.theme,
      postType: "",
    };

    // Read templates
    const { veTemplate, teamsTemplate } = await postGeneratorService.getSettings();

    // Build prompts
    const veTokens = { ...tokens, postType: "Viva Engage" };
    const teamsTokens = { ...tokens, postType: "Teams" };

    const vePrompt = buildPrompt(veTemplate.sections, veTokens);
    const teamsPrompt = buildPrompt(teamsTemplate.sections, teamsTokens);

    // Generate
    const result = await generatePosts(vePrompt, teamsPrompt, apiKey);

    return ok({
      vivaEngagePost: parsed.type === "basic" ? result.vePost : "",
      teamsPost: result.teamsPost,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(400, "Invalid payload.");
    }
    if (error instanceof OpenRouterError) {
      return errorResponse(502, `OpenRouter error: ${error.message}`);
    }
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    console.error("POST /api/competitions/post-generator/generate error:", error);
    return errorResponse(500, "Failed to generate posts.");
  }
}

function formatDuration(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt || !endsAt) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${startsAt.toLocaleDateString("en-GB", opts)}–${endsAt.toLocaleDateString("en-GB", opts)}`;
}
