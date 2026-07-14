import Link from "next/link";
import { DashboardSummary, hasAdminAccess } from "@/lib/contracts";
import { ActivityFeed } from "@/components/activity-feed";
import { LeaderboardCard } from "@/components/leaderboard-card";
import { PodComparison } from "@/components/pod-comparison";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardOverviewProps {
  summary: DashboardSummary;
}

export function DashboardOverview({ summary }: DashboardOverviewProps) {
  const admin = hasAdminAccess(summary.user.roles);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="glass-card col-span-1">
        <CardHeader>
          <CardTitle>{admin ? "Operations snapshot" : "Your workspace"}</CardTitle>
          <CardDescription>
            {admin
              ? "Quick view of the V3 foundation footprint."
              : "Your current assignments in the new backend."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-glass/50 p-4 rounded-xl border border-glass-border">
              <div className="text-3xl font-bold text-primary">{summary.assignedPods.length}</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">Assigned pods</div>
            </div>
            <div className="bg-glass/50 p-4 rounded-xl border border-glass-border">
              <div className="text-3xl font-bold text-primary">{summary.dailyKpiSum}</div>
              <div className="text-sm font-medium text-muted-foreground mt-1">KPI points today</div>
            </div>
            {summary.metrics && (
              <>
                <div className="bg-glass/50 p-4 rounded-xl border border-glass-border">
                  <div className="text-3xl font-bold text-primary">{summary.metrics.users}</div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">Users</div>
                </div>
                <div className="bg-glass/50 p-4 rounded-xl border border-glass-border">
                  <div className="text-3xl font-bold text-primary">{summary.metrics.campaigns}</div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">Campaigns</div>
                </div>
                <div className="bg-glass/50 p-4 rounded-xl border border-glass-border">
                  <div className="text-3xl font-bold text-primary">{summary.metrics.pods}</div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">Pods</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card col-span-1">
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
          <CardDescription>Use the new V3 routes instead of legacy vendor-driven screens.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {[
              { href: "/profile", title: "Profile", desc: "Validate current-user reads and password changes." },
              ...(admin ? [
                { href: "/campaigns", title: "Campaigns", desc: "Manage the first core aggregate in the new service layer." },
                { href: "/pods", title: "Pods & memberships", desc: "Assign users to pods under the new Postgres ownership model." },
                { href: "/competitions/manage", title: "Manage Competitions", desc: "Configure rules, teams, and standings on the V3 backend." },
              ] : []),
              { href: "/performance", title: "Performance", desc: "Log KPI values and inspect new Postgres-backed rollups." },
              { href: "/competitions", title: "Competitions", desc: "Log competition scores and inspect live standings." }
            ].map((link) => (
              <Link key={link.href} href={link.href} className="flex flex-col p-3 rounded-lg hover:bg-glass/60 border border-transparent hover:border-glass-border transition-colors">
                <span className="font-semibold text-foreground">{link.title}</span>
                <span className="text-sm text-muted-foreground">{link.desc}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {summary.podComparisons && summary.podComparisons.length > 0 && (
        <div className="col-span-1 md:col-span-2">
          <PodComparison pods={summary.podComparisons} />
        </div>
      )}

      {summary.leaderboard && (
        <div className="col-span-1 md:col-span-2">
          <LeaderboardCard 
            competitionId={summary.leaderboard.competitionId}
            name={summary.leaderboard.name}
            rankings={summary.leaderboard.rankings}
          />
        </div>
      )}

      <Card className="glass-card col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>Recent events across the new service layer.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={summary.recentActivities} />
        </CardContent>
      </Card>

      <Card className="glass-card col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>{admin ? "Pods with assigned members" : "Your pods"}</CardTitle>
          <CardDescription>
            {admin
              ? "This shows the new membership model in action."
              : "These are the pods currently attached to your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.assignedPods.length === 0 ? (
              <p className="text-sm text-muted-foreground w-full">No pod assignments yet.</p>
            ) : (
              summary.assignedPods.map((pod) => (
                <div key={pod.id} className="bg-glass/50 p-4 flex flex-col gap-3 rounded-xl border border-glass-border">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{pod.name}</span>
                      {pod.campaignName && (
                        <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full uppercase tracking-wider">{pod.campaignName}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{pod.description || "No description yet."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {pod.members.map((member) => (
                      <span key={member.id} className="bg-glass/80 text-foreground text-xs px-2 py-1 rounded-full border border-glass-border">
                        {member.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
