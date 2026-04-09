import { errorResponse, ok } from "@/server/http";
import { competitionDraftService } from "@/server/services/competition-draft-service";
import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[Publish] Attempting to publish draft: ${id}`);
    
    // Get the draft
    const draft = await prisma.competition.findUnique({
      where: { id },
      include: { rules: true, teams: true },
    });
    
    console.log(`[Publish] Draft found:`, draft ? { 
      id: draft.id, 
      isDraft: draft.isDraft, 
      name: draft.name,
      rulesInTable: draft.rules.length,
      teamsInTable: draft.teams.length,
    } : 'null');
    
    if (!draft) {
      console.log(`[Publish] Draft not found`);
      return errorResponse(404, "Draft not found.");
    }
    
    if (!draft.isDraft) {
      console.log(`[Publish] Not a draft (isDraft=false)`);
      return errorResponse(404, "Draft not found.");
    }
    
    // Parse draftData if it exists
    const draftData = draft.draftData as {
      name?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      campaignId?: string;
      podIds?: string[];
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
    
    console.log(`[Publish] draftData:`, {
      hasDraftData: !!draftData,
      rulesInDraftData: draftData?.rules?.length || 0,
      teamsInDraftData: draftData?.teams?.length || 0,
    });
    
    // Delete existing rules and teams
    await prisma.competitionRule.deleteMany({ where: { competitionId: id } });
    await prisma.competitionTeam.deleteMany({ where: { competitionId: id } });
    
    // Create rules from draft data
    const rules = draftData?.rules || draft.rules || [];
    console.log(`[Publish] Creating ${rules.length} rules`);
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
    const teams = draftData?.teams || draft.teams || [];
    console.log(`[Publish] Creating ${teams.length} teams`);
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
        campaignId: draftData?.campaignId ?? draft.campaignId,
        podIds: draftData?.podIds ?? draft.podIds,
      },
      include: {
        rules: true,
        teams: true,
      },
    });
    
    console.log(`[Publish] Published competition:`, {
      id: competition.id,
      name: competition.name,
      rulesCount: competition.rules.length,
      teamsCount: competition.teams.length,
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
