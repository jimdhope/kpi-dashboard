import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TeamsWebhooksAdmin } from "@/components/teams-webhooks-admin";
import { authService } from "@/server/services/auth-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

export default async function TeamsIntegrationsPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const webhooks = await teamsWebhookService.listWebhooks();

  return (
    <AppShell
      user={session.user}
      title="Teams webhooks"
      description="Central incoming and outgoing Teams webhooks for campaigns, pods, and the automation center."
    >
      <TeamsWebhooksAdmin initialWebhooks={webhooks} />
    </AppShell>
  );
}
