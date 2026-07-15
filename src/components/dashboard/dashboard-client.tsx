"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ManagementDashboard } from "@/app/(admin)/admin/page";
import { AgentDashboard } from "@/app/(agent)/agent/page";
import type { AppUser } from "@/lib/contracts";

export function DashboardClient({
  user,
  initialView,
}: {
  user: AppUser;
  initialView: "management" | "agent";
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const hasAgentRole = user.roles.includes("agent");
  const hasManagementRole = user.roles.some((role) => role !== "agent");
  const canSwitchViews = hasAgentRole && hasManagementRole;

  function changeView(nextView: "management" | "agent") {
    setView(nextView);
    router.replace(nextView === "agent" ? "/dashboard?view=agent" : "/dashboard");
  }

  return (
    <div className="space-y-4">
      {canSwitchViews && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" aria-label="Dashboard view">
            <Button
              type="button"
              size="sm"
              variant={view === "management" ? "secondary" : "ghost"}
              onClick={() => changeView("management")}
            >
              Admin view
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "agent" ? "secondary" : "ghost"}
              onClick={() => changeView("agent")}
            >
              Agent view
            </Button>
          </div>
        </div>
      )}
      {view === "management" ? <ManagementDashboard /> : <AgentDashboard initialUser={user} />}
    </div>
  );
}
