import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { isAverageKpiType } from '@/lib/utils';

/**
 * Single source of truth for Performance dashboard scoring.
 *
 * The leaderboard cards and the downloadable certificates MUST render the same
 * numbers, so both consume these helpers rather than re-deriving the maths.
 * Certificate generation previously reimplemented this logic and drifted
 * (it scored on `loggedAt` instead of `date` and anchored its six-week window
 * to the newest log of *any* KPI), which is what made the downloads disagree
 * with the on-screen leaderboards.
 */

export type PerformanceTimeframe = 'thisWeek' | 'thisMonth' | 'last6weeks' | 'allTime';

export interface ScoringKpi {
  id: string;
  name: string;
  initials?: string | null;
  type: string;
  /** Prisma `Decimal` serialises to a JSON string, so both forms are accepted. */
  maxValue?: number | string | null;
  sortOrder?: string | null;
}

export interface ScoringLog {
  kpiId: string;
  userId: string | null;
  value: number;
  /** When the KPI was achieved. Scoring always uses this, never `loggedAt`. */
  date: string;
}

export interface ScoringUser {
  id: string;
  name: string;
}

export interface ScoringEntry {
  agentId: string;
  agentName: string;
  score: number;
  rank: number;
}

export interface ScoringLeaderboard {
  kpi: ScoringKpi;
  entries: ScoringEntry[];
}

/** Ranked rows rendered per KPI. */
export const LEADERBOARD_SIZE = 5;

/** Weeks averaged together by the "Last 6 Weeks" timeframe. */
const WEEKLY_BUCKETS = 6;

/** Total span, in days, of the "Last 6 Weeks" timeframe. */
const LAST_SIX_WEEKS_DAYS = 42;

export const PERFORMANCE_TIMEFRAMES: readonly PerformanceTimeframe[] = [
  'thisWeek',
  'thisMonth',
  'last6weeks',
  'allTime',
] as const;

export function normalizeTimeframe(value: string | null | undefined): PerformanceTimeframe {
  return PERFORMANCE_TIMEFRAMES.includes(value as PerformanceTimeframe)
    ? (value as PerformanceTimeframe)
    : 'last6weeks';
}

/**
 * Narrow a full log set down to the records that count for a timeframe.
 * Every window is derived from `log.date` (when the KPI was achieved) so that
 * imported-but-backdated scores land in the period they were actually earned.
 */
export function filterLogsForTimeframe(
  logs: readonly ScoringLog[],
  timeframe: PerformanceTimeframe,
  now: Date = new Date(),
): ScoringLog[] {
  if (logs.length === 0) return [];

  let start: Date;
  let end: Date = now;

  switch (timeframe) {
    case 'thisWeek':
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;

    case 'thisMonth':
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;

    case 'last6weeks': {
      // Each KPI is anchored to its own most recent achievement date.
      const maxDates: Record<string, Date> = {};
      for (const log of logs) {
        const d = new Date(log.date);
        if (!maxDates[log.kpiId] || d > maxDates[log.kpiId]) maxDates[log.kpiId] = d;
      }
      return logs.filter((log) => {
        const max = maxDates[log.kpiId];
        if (!max) return false;
        const d = new Date(log.date);
        return d >= subDays(max, LAST_SIX_WEEKS_DAYS) && d <= max;
      });
    }

    case 'allTime':
    default: {
      const times = logs.map((log) => new Date(log.date).getTime());
      start = new Date(Math.min(...times));
      end = new Date(Math.max(...times));
      break;
    }
  }

  return logs.filter((log) => {
    const d = new Date(log.date);
    return d >= start && d <= end;
  });
}

/**
 * Score one agent for the "Last 6 Weeks" timeframe: average the per-week
 * averages, skipping weeks with no data so a part-logged period is not
 * treated as a zero.
 */
function sixWeekScore(agentLogs: readonly ScoringLog[], maxDate: Date): number {
  const weeklyAverages: number[] = [];

  for (let i = 0; i < WEEKLY_BUCKETS; i++) {
    const weekEnd = new Date(maxDate);
    weekEnd.setDate(maxDate.getDate() - i * 7);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekLogs = agentLogs.filter((log) => {
      const d = new Date(log.date);
      return d >= weekStart && d <= weekEnd;
    });

    if (weekLogs.length > 0) {
      weeklyAverages.push(weekLogs.reduce((sum, log) => sum + log.value, 0) / weekLogs.length);
    }
  }

  if (weeklyAverages.length === 0) return 0;
  return weeklyAverages.reduce((sum, average) => sum + average, 0) / weeklyAverages.length;
}

/** Build the ranked leaderboards the dashboard renders and the certificates copy. */
export function buildKpiLeaderboards(params: {
  kpis: readonly ScoringKpi[];
  logs: readonly ScoringLog[];
  users: readonly ScoringUser[];
  timeframe: PerformanceTimeframe;
  now?: Date;
}): ScoringLeaderboard[] {
  const { kpis, logs, users, timeframe, now = new Date() } = params;
  if (kpis.length === 0) return [];

  const filteredLogs = filterLogsForTimeframe(logs, timeframe, now);

  return kpis.map((kpi) => {
    const kpiLogs = filteredLogs.filter((log) => log.kpiId === kpi.id);
    const averagesOverTime = isAverageKpiType(kpi.type);

    // Only rate-style KPIs are bucketed into weeks; `number` KPIs are cumulative.
    const useWeeklyAverage = timeframe === 'last6weeks' && averagesOverTime;
    const kpiMaxDate = useWeeklyAverage
      ? kpiLogs.reduce<Date | null>((latest, log) => {
          const d = new Date(log.date);
          return !latest || d > latest ? d : latest;
        }, null)
      : null;

    const totals: Record<string, { sum: number; count: number }> = {};
    for (const log of kpiLogs) {
      if (!log.userId) continue;
      if (!totals[log.userId]) totals[log.userId] = { sum: 0, count: 0 };
      totals[log.userId].sum += log.value;
      totals[log.userId].count += 1;
    }

    const agentScores: Record<string, number> = {};
    for (const [agentId, total] of Object.entries(totals)) {
      if (useWeeklyAverage && kpiMaxDate) {
        agentScores[agentId] = sixWeekScore(kpiLogs.filter((log) => log.userId === agentId), kpiMaxDate);
      } else if (averagesOverTime) {
        agentScores[agentId] = total.count > 0 ? total.sum / total.count : 0;
      } else {
        agentScores[agentId] = total.sum;
      }
    }

    const entries = Object.entries(agentScores)
      .map(([agentId, score]) => ({
        agentId,
        agentName: users.find((user) => user.id === agentId)?.name || 'Unknown',
        score,
      }))
      .sort((a, b) => (kpi.sortOrder === 'asc' ? a.score - b.score : b.score - a.score))
      .slice(0, LEADERBOARD_SIZE)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return { kpi, entries };
  });
}

export function normalizeKpiMaxValue(maxValue: ScoringKpi['maxValue']): number | null {
  if (maxValue === null || maxValue === undefined || maxValue === '') return null;
  const parsed = typeof maxValue === 'number' ? maxValue : Number(maxValue);
  return Number.isFinite(parsed) ? parsed : null;
}

/** How a score is rendered in the leaderboard cards. */
export function formatLeaderboardScore(kpi: ScoringKpi, score: number): string {
  if (kpi.type === 'percentage') return `${score.toFixed(1)}%`;
  return score.toLocaleString();
}

/**
 * How a score is rendered on a certificate. Uses the leaderboard's own
 * formatting so the two never read as different numbers, then adds the `/ max`
 * denominator for bounded scores.
 */
export function formatDownloadScore(kpi: ScoringKpi, score: number): string {
  const base = formatLeaderboardScore(kpi, score);
  if (kpi.type !== 'scoreOutOf') return base;
  const max = normalizeKpiMaxValue(kpi.maxValue);
  return max === null ? base : `${base} / ${Math.round(max)}`;
}
