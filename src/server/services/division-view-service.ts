import "server-only";

import { divisionRepository } from "@/server/repositories/division-repository";
import {
  activeTiers,
  parseLeagueConfig,
} from "@/server/services/division-config";
import { listLeaguesForUser } from "@/server/services/division-league-service";
import { appSettingService } from "@/server/services/app-setting-service";
import {
  getLeagueTables,
  type LeagueTablesView,
} from "@/server/services/division-standings-service";

export async function getActiveLeagueTables(options: {
  view?: "month" | "block";
  monthKey?: string;
}): Promise<LeagueTablesView[]> {
  const leagues = await divisionRepository.listActiveLeagues();
  return Promise.all(
    leagues.map((league) => getLeagueTables(league.id, options)),
  );
}

export type LeagueOverview = {
  id: string;
  name: string;
  scopeType: string;
  scopeTargetId: string | null;
  cupName: string;
  blockStart: string;
  blockEnd: string;
  tierCount: number;
  tiers: string[];
  isActive: boolean;
  currentAssignmentCount: number;
};

export async function getLeaguesOverview(): Promise<LeagueOverview[]> {
  const leagues = await divisionRepository.listLeagues();
  const overviews = await Promise.all(
    leagues.map(async (league) => {
      const config = parseLeagueConfig(league.configJson);
      const assignments = await divisionRepository.getCurrentAssignments(league.id);
      return {
        id: league.id,
        name: league.name,
        scopeType: league.scopeType,
        scopeTargetId: league.scopeType === "POD" ? league.podId : league.campaignId,
        cupName: config.cupName,
        blockStart: config.blockStart,
        blockEnd: config.blockEnd,
        tierCount: league.tierCount,
        tiers: activeTiers(league.tierCount),
        isActive: league.isActive,
        currentAssignmentCount: assignments.length,
      };
    }),
  );
  return overviews;
}

export type TrophyCabinetLeague = {
  leagueId: string;
  leagueName: string;
  cupName: string;
  titles: Array<{
    id: string;
    division: string;
    periodType: string;
    periodLabel: string;
    userName: string | null;
    userId: string;
    points: number;
  }>;
};

function labelForPeriod(periodStart: Date, periodType: string): string {
  if (periodType === "MONTH") {
    return periodStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return `Block ending ${periodStart.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}`;
}

export async function getTrophyCabinet(): Promise<TrophyCabinetLeague[]> {
  const leagues = await divisionRepository.listLeagues();
  const cabinet: TrophyCabinetLeague[] = [];
  for (const league of leagues) {
    const config = parseLeagueConfig(league.configJson);
    const titles = await divisionRepository.findTitles({ leagueId: league.id, take: 500 });
    if (titles.length === 0) continue;
    cabinet.push({
      leagueId: league.id,
      leagueName: league.name,
      cupName: config.cupName,
      titles: titles.map((title) => ({
        id: title.id,
        division: title.division,
        periodType: title.periodType,
        periodLabel: labelForPeriod(title.periodStart, title.periodType),
        userName: title.userName,
        userId: title.userId,
        points: title.points,
      })),
    });
  }
  return cabinet;
}

export type MyDivisionCard = {
  visible: boolean;
  podLeague:
    | {
        leagueId: string;
        leagueName: string;
        cupName: string;
        divisionLabel: string;
        periodLabel: string;
        myRow: LeagueTablesView["tiers"][number]["rows"][number] | null;
        topRows: LeagueTablesView["tiers"][number]["rows"][number][];
      }
    | null;
  campaignSummary: {
    leagueName: string;
    cupName: string;
    divisionLabel: string;
    position: number | null;
    of: number;
    points: number;
  } | null;
};

export async function getMyDivisionCard(userId: string): Promise<MyDivisionCard> {
  const empty: MyDivisionCard = { visible: false, podLeague: null, campaignSummary: null };
  const settings = await appSettingService.getDivisionsSettings();
  if (!settings.enabled || !settings.dashboardCardEnabled) return empty;

  const leagues = await listLeaguesForUser(userId);
  if (leagues.length === 0) return empty;

  const card: MyDivisionCard = { visible: true, podLeague: null, campaignSummary: null };

  for (const league of leagues) {
    const tables = await getLeagueTables(league.id, { view: "month" });
    const myTable = tables.tiers.find((tier) => tier.rows.some((row) => row.userId === userId));
    const myRow = myTable?.rows.find((row) => row.userId === userId) ?? null;

    if (league.scopeType === "POD" && !card.podLeague) {
      card.podLeague = {
        leagueId: league.id,
        leagueName: league.name,
        cupName: tables.league.cupName,
        divisionLabel: myTable?.division ?? "—",
        periodLabel: tables.periodLabel,
        myRow,
        topRows: (myTable?.rows ?? []).slice(0, 5),
      };
    } else if (league.scopeType === "CAMPAIGN" && myTable && myRow) {
      card.campaignSummary = {
        leagueName: league.name,
        cupName: tables.league.cupName,
        divisionLabel: myTable.division,
        position: myRow.rank,
        of: myTable.rows.length,
        points: myRow.points,
      };
    }
  }

  return card;
}
