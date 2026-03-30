import { redirect } from "next/navigation";
import { TeamsWebhooksAdmin } from "@/components/teams-webhooks-admin";
import { TeamsTemplatesAdmin } from "@/components/teams-templates-admin";
import { authService } from "@/server/services/auth-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";
import { teamsMessageTemplateService } from "@/server/services/teams-message-template-service";

export default async function TeamsChannelsPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const webhooks = await teamsWebhookService.listWebhooks();
  const templates = await teamsMessageTemplateService.listTemplates();

  return (
    <>
      <TeamsWebhooksAdmin initialWebhooks={webhooks} />
      <TeamsTemplatesAdmin initialTemplates={templates} />
    </>
  );
}
