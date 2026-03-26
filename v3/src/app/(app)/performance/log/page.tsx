import { authService } from "@/server/services/auth-service";
import { PerformanceLogForm } from "./performance-log-form";
import { prisma } from "@/server/db/client";

export default async function PerformanceLogPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) throw new Error("Unauthorized");

  const [pods, trackers] = await Promise.all([
    prisma.pod.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.trackerKpi.findMany({ select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Log Scores</h1>
        <p className="text-muted-foreground">Enter daily KPI scores for each agent</p>
      </div>

      <PerformanceLogForm pods={pods} trackers={trackers} currentUserId={session.user.id} />
    </div>
  );
}
