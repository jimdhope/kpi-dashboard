import { redirect } from "next/navigation";
import { TeamsWebhooksAdmin } from "@/components/teams-webhooks-admin";
import { authService } from "@/server/services/auth-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";

export default async function TeamsWebhooksPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  if (!session.user.roles.includes("admin")) {
    redirect("/dashboard");
  }

  const webhooks = await teamsWebhookService.listWebhooks();

  return <TeamsWebhooksAdmin initialWebhooks={webhooks} />;
}
