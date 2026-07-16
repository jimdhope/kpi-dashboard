import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const query = await searchParams;
  const hasAgentRole = session.user.roles.includes("agent");
  const canUseManagementView = await permissionService.hasEffectiveAdminAccess(session.user.roles);
  const initialView = query.view === "agent" && hasAgentRole
    ? "agent"
    : canUseManagementView ? "management" : "agent";

  return <DashboardClient user={session.user} initialView={initialView} canUseManagementView={canUseManagementView} />;
}
