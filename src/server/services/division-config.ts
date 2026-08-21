import "server-only";

export const LEAGUE_TIERS = ["PREMIER", "CHAMPIONSHIP", "LEAGUE_ONE"] as const;

export type LeagueTier = (typeof LEAGUE_TIERS)[number];

export type LeagueScopeTypeValue = "POD" | "CAMPAIGN";

export type LeagueSeasonConfig = {
  cupName: string;
  blockStart: string;
  blockEnd: string;
  promotionSlots: number;
  relegationSlots: number;
  absenceProtectionThreshold: number;
  seedingLookbackCompetitions: number;
};

export const DEFAULT_SEASON_CONFIG: LeagueSeasonConfig = {
  cupName: "Autumn Cup",
  blockStart: "2026-09-01",
  blockEnd: "2026-12-31",
  promotionSlots: 2,
  relegationSlots: 2,
  absenceProtectionThreshold: 0.5,
  seedingLookbackCompetitions: 8,
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeDateKey(value: unknown, fallback: string): string {
  if (typeof value === "string" && DATE_KEY_PATTERN.test(value)) return value;
  return fallback;
}

export function parseLeagueConfig(raw: unknown): LeagueSeasonConfig {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const blockStart = normalizeDateKey(source.blockStart, DEFAULT_SEASON_CONFIG.blockStart);
  let blockEnd = normalizeDateKey(source.blockEnd, DEFAULT_SEASON_CONFIG.blockEnd);
  if (blockEnd < blockStart) blockEnd = blockStart;
  return {
    cupName:
      typeof source.cupName === "string" && source.cupName.trim().length > 0
        ? source.cupName.trim()
        : DEFAULT_SEASON_CONFIG.cupName,
    blockStart,
    blockEnd,
    promotionSlots: clampInt(source.promotionSlots, 0, 4, DEFAULT_SEASON_CONFIG.promotionSlots),
    relegationSlots: clampInt(source.relegationSlots, 0, 4, DEFAULT_SEASON_CONFIG.relegationSlots),
    absenceProtectionThreshold: (() => {
      const parsed = typeof source.absenceProtectionThreshold === "number"
        ? source.absenceProtectionThreshold
        : Number.NaN;
      if (!Number.isFinite(parsed)) return DEFAULT_SEASON_CONFIG.absenceProtectionThreshold;
      return Math.min(1, Math.max(0, parsed));
    })(),
    seedingLookbackCompetitions: clampInt(
      source.seedingLookbackCompetitions,
      1,
      26,
      DEFAULT_SEASON_CONFIG.seedingLookbackCompetitions,
    ),
  };
}

export function activeTiers(tierCount: number): LeagueTier[] {
  const count = Math.min(LEAGUE_TIERS.length, Math.max(2, Math.round(tierCount) || 3));
  return LEAGUE_TIERS.slice(0, count);
}

export function bottomTier(tierCount: number): LeagueTier {
  const tiers = activeTiers(tierCount);
  return tiers[tiers.length - 1] ?? "LEAGUE_ONE";
}

export function tierSizesFor(playerCount: number, tierCount: number): number[] {
  const tiers = activeTiers(tierCount);
  if (playerCount <= 0) return tiers.map(() => 0);
  const base = Math.floor(playerCount / tiers.length);
  const remainder = playerCount % tiers.length;
  return tiers.map((_, index) => base + (index < remainder ? 1 : 0));
}
