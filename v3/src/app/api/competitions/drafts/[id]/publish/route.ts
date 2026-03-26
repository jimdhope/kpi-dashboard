import { errorResponse, ok } from "@/server/http";
import { competitionDraftService } from "@/server/services/competition-draft-service";
import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get the draft
    const draft = await prisma.competition.findUnique({
      where: { id },
      include: { rules: true, teams: true },
    });
    
    if (!draft || !draft.isDraft) {
      return errorResponse(404, "Draft not found.");
    }
    
    // Parse draftData if it exists
    const draftData = draft.draftData as {
      name?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      rules?: Array<{
        id?: string;
        title: string;
        points: number;
        isCheckbox?: boolean;
        emoji?: string;
        dailyTarget?: number;
      }>;
      teams?: Array<{
        id?: string;
        name: string;
        agentIds?: string[];
        emoji?: string;
      }>;
    } | null;
    
    // Delete existing rules and teams
    await prisma.competitionRule.deleteMany({ where: { competitionId: id } });
    await prisma.competitionTeam.deleteMany({ where: { competitionId: id } });
    
    // Create rules from draft data
    const rules = draftData?.rules || [];
    if (rules.length > 0) {
      await prisma.competitionRule.createMany({
        data: rules.map(rule => ({
          competitionId: id,
          title: rule.title,
          points: rule.points,
          isCheckbox: rule.isCheckbox ?? false,
          emoji: rule.emoji ?? null,
          dailyTarget: rule.dailyTarget ?? null,
        })),
      });
    }
    
    // Create teams from draft data
    const teams = draftData?.teams || [];
    if (teams.length > 0) {
      await prisma.competitionTeam.createMany({
        data: teams.map(team => ({
          competitionId: id,
          name: team.name,
          agentIds: team.agentIds ?? [],
          emoji: team.emoji ?? null,
        })),
      });
    }
    
    // Publish the draft
    const competition = await prisma.competition.update({
      where: { id },
      data: {
        isDraft: false,
        name: draftData?.name || draft.name,
        description: draftData?.description || draft.description,
        startsAt: draftData?.startsAt ? new Date(draftData.startsAt) : draft.startsAt,
        endsAt: draftData?.endsAt ? new Date(draftData.endsAt) : draft.endsAt,
      },
      include: {
        rules: true,
        teams: true,
      },
    });
    
    // Clear draftData separately if needed
    if (draft.draftData) {
      await prisma.competition.update({
        where: { id },
        data: { draftData: Prisma.JsonNull },
      });
    }
    
    return ok({ competition });
  } catch (error) {
    console.error("POST /api/competitions/drafts/[id]/publish error:", error);
    return errorResponse(500, "Failed to publish draft.");
  }
}
