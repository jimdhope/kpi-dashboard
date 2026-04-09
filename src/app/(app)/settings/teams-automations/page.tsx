import { redirect } from "next/navigation";
import { TeamsAutomationAdmin } from "@/components/teams-automation-admin";
import { authService } from "@/server/services/auth-service";
import { campaignService } from "@/server/services/campaign-service";
import { podService } from "@/server/services/pod-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

export default async function TeamsAutomationsPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("admin")) {
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

  return (
    <TeamsAutomationAdmin
      campaigns={campaigns}
      initialAutomations={automations}
      pods={pods}
      recentEvents={recentEvents}
      templates={templates}
      webhooks={webhooks}
    />
  );
}
