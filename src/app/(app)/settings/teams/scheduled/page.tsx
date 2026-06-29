import { redirect } from "next/navigation";
import { TeamsScheduledAdmin } from "@/components/teams-scheduled-admin";
import { authService } from "@/server/services/auth-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

export default async function TeamsScheduledPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const [automations, webhooks, templates] = await Promise.all([
    teamsAutomationService.listAutomations(),
    teamsWebhookService.listWebhooks(),
    teamsMessageTemplateService.listTemplates(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Scheduled Messages</h1>
        <p className="text-muted-foreground mt-1">
          Schedule recurring Teams messages.
        </p>
      </div>

      <TeamsScheduledAdmin
        webhooks={webhooks}
        templates={templates}
        initialAutomations={automations}
      />
    </div>
  );
}
