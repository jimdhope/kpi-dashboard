import { redirect } from "next/navigation";
import { TeamsAutomationAdmin } from "@/components/teams-automation-admin";
import { authService } from "@/server/services/auth-service";
import { campaignService } from "@/server/services/campaign-service";
import { podService } from "@/server/services/pod-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";
import { competitionService } from "@/server/services/competition-service";
import { prisma } from "@/server/db/client";
import { permissionService } from "@/server/services/permission-service";

export default async function TeamsWorkflowsPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  const isAdmin = await permissionService.hasEffectiveAdminAccess(session.user.roles);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const [automations, recentEvents, campaigns, pods, webhooks, templates] = await Promise.all([
    teamsAutomationService.listAutomations(),
    teamsAutomationService.listRecentIncomingEvents(),
    campaignService.listCampaigns(),
    podService.listPods(),
    teamsWebhookService.listWebhooks(),
    teamsMessageTemplateService.listTemplates(),
  ]);

  // Fetch leaderboard data for preview
  // Try active competition first, then most recent
  let leaderboardData = null;
  let teamStandingsData = null;
  
  const activeComp = await prisma.competition.findFirst({
    where: { endsAt: { gte: new Date() } },
    orderBy: { startsAt: "desc" },
  });

  if (activeComp) {
    try {
      leaderboardData = await competitionService.getLeaderboard(activeComp.id);
      teamStandingsData = await competitionService.getTeamStandings(activeComp.id);
    } catch {
      // Ignore errors, preview will show sample data
    }
  } else {
    // Fallback to most recent competition
    const latestComp = await prisma.competition.findFirst({
      orderBy: { endsAt: "desc" },
    });
    if (latestComp) {
      try {
        leaderboardData = await competitionService.getLeaderboard(latestComp.id);
        teamStandingsData = await competitionService.getTeamStandings(latestComp.id);
      } catch {
        // Ignore errors
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Teams Workflows</h1>
        <p className="text-muted-foreground mt-1">
          Create "If This, Then That" workflows to send messages to Teams channels.
        </p>
      </div>
      
      <TeamsAutomationAdmin
        campaigns={campaigns}
        initialAutomations={automations}
        pods={pods}
        recentEvents={recentEvents}
        templates={templates}
        webhooks={webhooks}
        leaderboardData={leaderboardData}
        teamStandingsData={teamStandingsData}
      />
    </div>
  );
}
