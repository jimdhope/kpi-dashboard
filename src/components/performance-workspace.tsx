"use client";

import { useState } from "react";
import { PerformanceOverview, TrackerKpiRecord, hasAdminAccess, AppUser } from "@/lib/contracts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PerformanceWorkspaceProps {
  user: AppUser;
  trackers: TrackerKpiRecord[];
  overview: PerformanceOverview;
}

export function PerformanceWorkspace({ user, trackers, overview }: PerformanceWorkspaceProps) {
  const [currentOverview, setCurrentOverview] = useState(overview);
  const [trackerKpiId, setTrackerKpiId] = useState(trackers[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const admin = hasAdminAccess(user.roles);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/performance/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trackerKpiId,
        value: Number(value),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Failed to log performance.");
      return;
    }

    const overviewResponse = await fetch("/api/performance/overview");
    const updatedOverview = await overviewResponse.json();

    setCurrentOverview(updatedOverview);
    setValue("");
    setPending(false);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="glass-card col-span-1">
        <CardHeader>
          <CardTitle>Log performance</CardTitle>
          <CardDescription>Authenticated users can log KPI progress against the new tracker definitions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Tracker</label>
              <select 
                value={trackerKpiId} 
                onChange={(event) => setTrackerKpiId(event.target.value)} 
                required
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled className="bg-background text-foreground">
                  Select tracker
                </option>
                {trackers.map((tracker) => (
                  <option key={tracker.id} value={tracker.id} className="bg-background text-foreground">
                    {tracker.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Value</label>
              <input 
                value={value} 
                onChange={(event) => setValue(event.target.value)} 
                type="number" 
                step="0.01" 
                required 
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <Button disabled={pending || trackers.length === 0} type="submit" className="mt-2 text-white">
              {pending ? "Logging..." : "Log value"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card col-span-1">
        <CardHeader>
          <CardTitle>Tracker rollups</CardTitle>
          <CardDescription>Simple aggregate totals prove the reporting path.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {currentOverview.trackerSummaries.map((summary) => (
              <div className="bg-glass/50 p-4 rounded-xl border border-glass-border flex justify-between items-center" key={summary.trackerId}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <strong className="text-foreground">{summary.trackerName}</strong>
                    {summary.unit ? <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{summary.unit}</span> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">{summary.totalValue}</span> / Target: {summary.targetValue ?? 0}
                  </p>
                </div>
                <div className="text-xs font-semibold text-muted-foreground bg-background/50 px-2 py-1 rounded-md">
                  {summary.logCount} logs
                </div>
              </div>
            ))}
            {currentOverview.trackerSummaries.length === 0 ? <p className="text-sm text-muted-foreground">No performance logged yet.</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>{admin ? "Leaderboard" : "Recent activity"}</CardTitle>
          <CardDescription>
            {admin ? "Leaderboard totals by user from tracker logs." : "Your team activity feed from the latest tracker logs."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {admin ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-glass/50 border-b border-glass-border">
                    <tr>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOverview.userSummaries.map((summary) => (
                      <tr key={summary.userId} className="border-b border-glass-border/50 hover:bg-glass/40">
                        <td className="px-4 py-3 font-medium text-foreground">{summary.userName}</td>
                        <td className="px-4 py-3 text-primary font-bold">{summary.totalValue}</td>
                        <td className="px-4 py-3 text-muted-foreground">{summary.logCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {currentOverview.logs.slice(0, 8).map((log) => (
                <div className="flex items-center justify-between p-3 rounded-lg border border-glass-border bg-glass/50 hover:bg-glass/80 transition-colors" key={log.id}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <strong className="text-sm text-foreground">{log.trackerName}</strong>
                      {log.userName ? <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">{log.userName}</span> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">Value logged: <span className="font-semibold text-foreground">{log.value}</span></p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {currentOverview.logs.length === 0 ? <p className="text-sm text-muted-foreground">No logs yet.</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
