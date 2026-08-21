import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { DivisionLeagueTable } from "@/components/divisions/league-table";
import { authService } from "@/server/services/auth-service";
import { appSettingService } from "@/server/services/app-setting-service";
import { getActiveLeagueTables } from "@/server/services/division-view-service";
import { cn } from "@/lib/utils";

export default async function DivisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const settings = await appSettingService.getDivisionsSettings();
  if (!settings.enabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center py-16">
        <Trophy className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">Divisions League</h1>
        <p className="text-muted-foreground">The divisions league is not active right now.</p>
      </div>
    );
  }

  const query = await searchParams;
  const view = query.view === "block" ? "block" : "month";
  const tables = await getActiveLeagueTables({ view, monthKey: query.month });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Divisions League</h1>
          <p className="text-muted-foreground">
            {view === "month"
              ? "Monthly title sprints — most raw points in your division this month."
              : "Full block table — decides promotion and relegation at the reshuffle."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/divisions?view=month"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "month" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
            )}
          >
            Month
          </Link>
          <Link
            href="/divisions?view=block"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "block" ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
            )}
          >
            Block
          </Link>
          <Link
            href="/trophies"
            className="rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            🏆 Trophies
          </Link>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No leagues have been set up yet.
        </div>
      ) : (
        tables.map((league) => (
          <section key={league.league.id} className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-xl font-bold">{league.league.name}</h2>
              <span className="text-sm text-muted-foreground">
                {league.league.cupName} · {league.periodLabel}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {league.league.scopeType === "POD" ? "Pod league" : "Campaign league"}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {league.tiers.map((tier) => (
                <DivisionLeagueTable key={tier.division} table={tier} currentUserId={session.user?.id} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
