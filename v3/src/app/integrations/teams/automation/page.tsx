import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TeamsAutomationAdmin } from "@/components/teams-automation-admin";
import { authService } from "@/server/services/auth-service";
import { campaignService } from "@/server/services/campaign-service";
import { podService } from "@/server/services/pod-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

export default async function TeamsAutomationPage() {
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
    <AppShell
      user={session.user}
      title="Teams automation center"
      description="Manage reusable Teams automations across campaigns, pods, and webhook endpoints."
    >
      <TeamsAutomationAdmin
        campaigns={campaigns}
        initialAutomations={automations}
        pods={pods}
        recentEvents={recentEvents}
        templates={templates}
        webhooks={webhooks}
      />
    </AppShell>
  );
}
