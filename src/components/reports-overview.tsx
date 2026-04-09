import type { ReportsOverview as ReportsOverviewData } from "@/lib/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ReportsOverviewProps {
  report: ReportsOverviewData;
}

export function ReportsOverview({ report }: ReportsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="glass-card col-span-1 md:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Reporting snapshot</CardTitle>
          <CardDescription>
            Generated {new Date(report.generatedAt).toLocaleString()} from the
            current V3 relational model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[
              { label: "Campaigns", value: report.metrics.campaigns },
              {
                label: "Active campaigns",
                value: report.metrics.activeCampaigns,
              },
              { label: "Pods", value: report.metrics.pods },
              { label: "Memberships", value: report.metrics.memberships },
              { label: "Trackers", value: report.metrics.trackers },
              {
                label: "Performance logs",
                value: report.metrics.performanceLogs,
              },
              { label: "Competitions", value: report.metrics.competitions },
              {
                label: "Competition entries",
                value: report.metrics.competitionEntries,
              },
              { label: "Notifications", value: report.metrics.notifications },
              {
                label: "Unread notifications",
                value: report.metrics.unreadNotifications,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="flex flex-col p-4 rounded-lg border border-border bg-card/50"
              >
                <span className="text-2xl font-bold">{metric.value}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Top trackers</CardTitle>
          <CardDescription>
            Highest-volume KPI totals across all logged tracker values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.topTrackers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracker data yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {report.topTrackers.map((tracker) => (
                <div
                  key={tracker.trackerId}
                  className="flex flex-col gap-1 p-3 rounded-md border border-border bg-card/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      {tracker.trackerName}
                    </span>
                    {tracker.unit && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {tracker.unit}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Total: {tracker.totalValue}</span>
                    <span>{tracker.logCount} logs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Top performers</CardTitle>
          <CardDescription>
            User totals rolled up from tracker logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No performance data yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {report.topPerformers.map((performer) => (
                <div
                  key={performer.userId}
                  className="flex flex-col gap-1 p-3 rounded-md border border-border bg-card/50"
                >
                  <div className="font-semibold text-sm">
                    {performer.userName}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Total: {performer.totalValue}</span>
                    <span>{performer.logCount} logs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Campaign breakdown</CardTitle>
          <CardDescription>
            Current ownership footprint for campaigns, pods, and trackers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Pods</TableHead>
                <TableHead className="text-right">Trackers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.campaignBreakdown.map((campaign) => (
                <TableRow key={campaign.campaignId}>
                  <TableCell className="font-medium">
                    {campaign.campaignName}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.podCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.trackerCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Notification breakdown</CardTitle>
          <CardDescription>Unread vs total by notification type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {report.notificationBreakdown.map((row) => (
              <div
                key={row.type}
                className="flex items-center justify-between p-3 rounded-md border border-border bg-card/50"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm capitalize">
                    {row.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.total} total
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {row.unread} unread
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card col-span-1 md:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Competition standings</CardTitle>
          <CardDescription>
            Top entries and participation across active competition records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.competitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competition data yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.competitions.map((competition) => (
                <div
                  key={competition.competitionId}
                  className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {competition.competitionName}
                    </span>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        {competition.totalEntries} entries
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        Top {competition.topScore}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {competition.leaderboard.map((entry) => (
                      <span
                        key={entry.id}
                        className="text-xs px-2 py-1 rounded-full bg-muted/50 border border-border"
                      >
                        {entry.userName ?? "Unknown"}: {entry.score}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
