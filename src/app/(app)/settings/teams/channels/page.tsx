import { redirect } from "next/navigation";
import { TeamsWebhooksAdmin } from "@/components/teams-webhooks-admin";
import { authService } from "@/server/services/auth-service";
import { teamsWebhookService } from "@/server/services/teams-webhook-service";
import { permissionService } from "@/server/services/permission-service";

export default async function TeamsWebhooksPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) {
    redirect("/login");
  }

  const isAdmin = await permissionService.hasEffectiveAdminAccess(session.user.roles);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const webhooks = await teamsWebhookService.listWebhooks();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Teams Webhooks</h1>
        <p className="text-muted-foreground mt-1">
          Manage Microsoft Teams webhook endpoints for sending notifications.
        </p>
      </div>
      
      <TeamsWebhooksAdmin initialWebhooks={webhooks} />
    </div>
  );
}
