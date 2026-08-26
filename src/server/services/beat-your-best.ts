export const BYB_HISTORY_WINDOW = 8;
export const BYB_MIN_PRIOR_COMPETITIONS = 3;

export type BybEntrant = {
  userId: string;
  name: string;
  rawPoints: number;
};

export type BybPlayerHistory = {
  /** Chronological active-point totals for every prior non-draft competition, oldest first (zeros included). */
  totals: number[];
  /** Chronological participation flags aligned with `totals` (enrolled or scored). */
  participated: boolean[];
};

export type BybStanding = {
  userId: string;
  name: string;
  rawPoints: number;
  rollingBest: number | null;
  ratio: number | null;
  rank: number | null;
  beatBest: boolean;
  ranked: boolean;
};

export type BybStandingsResult = {
  standings: BybStanding[];
  topRawPoints: number;
};

export type BybPodChampion = {
  podId: string;
  podName: string;
  userId: string;
  name: string;
  rawPoints: number;
  ratio: number | null;
};

function roundRatio(ratio: number): number {
  return Math.round(ratio * 10) / 10;
}

/**
 * Pure "Beat Your Best" scoring.
 *
 - Rolling best = the player's highest weekly total across their last
   BYB_HISTORY_WINDOW prior competitions in which they scored > 0.
 - Players are unranked with fewer than BYB_MIN_PRIOR_COMPETITIONS prior
   competitions (participated) or a rolling best of 0.
 - Standings are ordered by ratio (this week's points as a % of the player's
   rolling best), descending. A player who beat their own rolling best is
   flagged with `beatBest` and recognised with a Personal Best certificate.
 * The top improver (highest ratio overall) is the Top Improvement champion.
 */
export function computeBybStandings(input: {
  currentWeek: BybEntrant[];
  historyByUser: Map<string, BybPlayerHistory>;
}): BybStandingsResult {
  const topRawPoints = input.currentWeek.reduce((max, entrant) => Math.max(max, entrant.rawPoints), 0);

  const evaluated: BybStanding[] = input.currentWeek.map((entrant) => {
    const history = input.historyByUser.get(entrant.userId);
    const totals = history?.totals ?? [];
    const participated = history?.participated ?? [];

    const scoringWeeks = totals.filter((total) => total > 0);
    const window = scoringWeeks.slice(-BYB_HISTORY_WINDOW);
    const rollingBest = window.length ? Math.max(...window) : 0;
    const priorCompetitionCount = participated.filter(Boolean).length;
    const ranked = priorCompetitionCount >= BYB_MIN_PRIOR_COMPETITIONS && rollingBest > 0;
    const beatBest = ranked && rollingBest !== null && entrant.rawPoints > rollingBest;
    const ratio = ranked ? roundRatio((entrant.rawPoints / rollingBest) * 100) : null;

    return {
      userId: entrant.userId,
      name: entrant.name,
      rawPoints: entrant.rawPoints,
      rollingBest: ranked ? rollingBest : null,
      ratio,
      rank: null,
      beatBest,
      ranked,
    };
  });

  // Rank every player that HAS a ratio (≥3 prior scoring weeks and a rolling
  // best > 0) by that ratio, descending — this is what the "this week as a % of
  // your best" leaderboard is meant to show. `qualified` (reaching half of this
  // week's top raw score) is a separate "eligible to win" badge and must NOT
  // reorder the list: otherwise a strong personal week with low absolute volume
  // (high ratio, low raw points) can appear BELOW a weaker personal week with
  // high absolute volume — inverting the displayed percentages (e.g. 3rd = 52.8%
  // while 4th = 93.5%). Players without a ratio (unranked) trail, by raw points.
  const ranked = evaluated
    .filter((standing) => standing.ranked)
    .sort((a, b) => b.ratio! - a.ratio! || b.rawPoints - a.rawPoints || a.name.localeCompare(b.name));
  const unranked = evaluated
    .filter((standing) => !standing.ranked)
    .sort((a, b) => b.rawPoints - a.rawPoints || a.name.localeCompare(b.name));

  ranked.forEach((standing, index) => {
    standing.rank = index + 1;
  });

  return {
    standings: [...ranked, ...unranked],
    topRawPoints,
  };
}

/**
 * Picks the pod an agent is attributed to when they scored in several:
 * the pod worth the most points, ties broken by lexicographic pod id.
 */
export function resolveBybPrimaryPod(pointsByPod: Map<string, number>): string | null {
  let best: { podId: string; points: number } | null = null;
  for (const [podId, points] of pointsByPod) {
    if (!best || points > best.points || (points === best.points && podId < best.podId)) {
      best = { podId, points };
    }
  }
  return best?.podId ?? null;
}

/**
 * One champion per pod: the highest-standing ranked player whose primary
 * pod (by score-event attribution) is that pod. Pods without any ranked
 * player produce no champion. Input standings may be unsorted.
 */
export function selectBybPodChampions(input: {
  standings: BybStanding[];
  podTotals: Array<{ podId: string; userId: string; points: number }>;
  podNamesById: Map<string, string>;
}): BybPodChampion[] {
  const pointsByUserByPod = new Map<string, Map<string, number>>();
  for (const total of input.podTotals) {
    let pointsByPod = pointsByUserByPod.get(total.userId);
    if (!pointsByPod) {
      pointsByPod = new Map();
      pointsByUserByPod.set(total.userId, pointsByPod);
    }
    pointsByPod.set(total.podId, (pointsByPod.get(total.podId) ?? 0) + total.points);
  }

  const primaryPodByUser = new Map<string, string>();
  for (const [userId, pointsByPod] of pointsByUserByPod) {
    const primaryPodId = resolveBybPrimaryPod(pointsByPod);
    if (primaryPodId) primaryPodByUser.set(userId, primaryPodId);
  }

  const championsByPod = new Map<string, BybStanding>();
  for (const standing of input.standings) {
    if (!standing.ranked) continue;
    const podId = primaryPodByUser.get(standing.userId);
    if (!podId || !input.podNamesById.has(podId)) continue;
    const current = championsByPod.get(podId);
    if (!current) {
      championsByPod.set(podId, standing);
      continue;
    }
    // Standings order: ratio desc, rawPoints desc, name asc.
    const challenger = standing;
    const better =
      (challenger.ratio ?? -1) > (current.ratio ?? -1) ||
      ((challenger.ratio ?? -1) === (current.ratio ?? -1) &&
        (challenger.rawPoints > current.rawPoints ||
          (challenger.rawPoints === current.rawPoints && challenger.name.localeCompare(current.name) < 0)));
    if (better) championsByPod.set(podId, challenger);
  }

  return [...championsByPod.entries()]
    .map(([podId, standing]) => ({
      podId,
      podName: input.podNamesById.get(podId) ?? podId,
      userId: standing.userId,
      name: standing.name,
      rawPoints: standing.rawPoints,
      ratio: standing.ratio,
    }))
    .sort((a, b) => a.podName.localeCompare(b.podName));
}
