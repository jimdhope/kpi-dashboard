import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { authService } from "@/server/services/auth-service";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const query = await searchParams;
  const hasAgentRole = session.user.roles.includes("agent");
  const hasManagementRole = session.user.roles.some((role) => role !== "agent");
  const initialView = query.view === "agent" && hasAgentRole
    ? "agent"
    : hasManagementRole ? "management" : "agent";

  return <DashboardClient user={session.user} initialView={initialView} />;
}
