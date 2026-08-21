import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authService } from "@/server/services/auth-service";
import { getTrophyCabinet } from "@/server/services/division-view-service";
import { appSettingService } from "@/server/services/app-setting-service";
import { divisionLabel, divisionBadgeClass } from "@/lib/divisions";
import { cn } from "@/lib/utils";

export default async function TrophiesPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const settings = await appSettingService.getDivisionsSettings();
  const cabinet = settings.enabled ? await getTrophyCabinet() : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏆 Trophy Cabinet</h1>
          <p className="text-muted-foreground">Division champions, past and present.</p>
        </div>
        <Link
          href="/divisions"
          className="rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          League tables →
        </Link>
      </div>

      {cabinet.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No titles have been crowned yet. Monthly champions appear here at the start of each month.
        </div>
      ) : (
        cabinet.map((league) => (
          <section key={league.leagueId} className="space-y-3">
            <h2 className="text-xl font-bold">
              {league.leagueName}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{league.cupName}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {league.titles.map((title) => (
                <Card key={title.id} variant="glass">
                  <CardHeader className="pb-1">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className={cn("text-[10px]", divisionBadgeClass(title.division))}>
                        {divisionLabel(title.division)}
                      </Badge>
                      <span className="text-muted-foreground font-normal">{title.periodLabel}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-bold">{title.userName ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {title.points.toLocaleString()} pts
                      {title.periodType === "BLOCK" ? " · block champion" : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
