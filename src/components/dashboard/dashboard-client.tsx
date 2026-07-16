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
  canUseManagementView,
}: {
  user: AppUser;
  initialView: "management" | "agent";
  canUseManagementView: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const hasAgentRole = user.roles.includes("agent");
  const canSwitchViews = hasAgentRole && canUseManagementView;

  function changeView(nextView: "management" | "agent") {
    setView(nextView);
    router.replace(nextView === "agent" ? "/dashboard?view=agent" : "/dashboard");
  }

  const viewToggle = canSwitchViews ? (
    <div className="inline-flex rounded-lg border border-white/12 bg-slate-950/30 p-1" aria-label="Dashboard view">
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
  ) : null;

  return (
    <div>
      {view === "management"
        ? <ManagementDashboard headerActions={viewToggle} />
        : <AgentDashboard initialUser={user} headerActions={viewToggle} />}
    </div>
  );
}
