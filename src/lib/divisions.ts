export const DIVISION_LABELS: Record<string, string> = {
  PREMIER: "Premier",
  CHAMPIONSHIP: "Championship",
  LEAGUE_ONE: "League One",
};

export function divisionLabel(division: string): string {
  return DIVISION_LABELS[division] ?? division;
}

export function divisionBadgeClass(division: string): string {
  if (division === "PREMIER") return "bg-purple-500/15 text-purple-600 border-purple-500/40";
  if (division === "CHAMPIONSHIP") return "bg-blue-500/15 text-blue-600 border-blue-500/40";
  return "bg-amber-500/15 text-amber-600 border-amber-500/40";
}

export type LeagueTableRow = {
  userId: string;
  userName: string | null;
  division: string;
  points: number;
  played: number;
  form: number[];
  rank: number;
};

export type LeagueTableData = {
  division: string;
  rows: LeagueTableRow[];
  promotionSlots: number;
  relegationSlots: number;
};

export type LeagueTableView = {
  league: {
    id: string;
    name: string;
    scopeType: string;
    cupName: string;
    blockStart: string;
    blockEnd: string;
  };
  view: string;
  periodKey: string;
  periodLabel: string;
  tiers: LeagueTableData[];
};
