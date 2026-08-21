import "server-only";

const LONDON_TIME_ZONE = "Europe/London";

const londonPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type LondonDateKey = string;

type LondonParts = { year: number; month: number; day: number };

function londonParts(instant: Date): LondonParts {
  const parts = londonPartsFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function londonOffsetMs(instant: Date): number {
  const parts = londonPartsFormatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function keyOf(parts: LondonParts): LondonDateKey {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function londonDateKey(instant: Date): LondonDateKey {
  return keyOf(londonParts(instant));
}

export function startOfLondonDay(key: LondonDateKey): Date {
  const [year, month, day] = key.split("-").map(Number);
  const noonGuess = new Date(Date.UTC(year, month - 1, day, 12));
  const offset = londonOffsetMs(noonGuess);
  return new Date(Date.UTC(year, month - 1, day) - offset);
}

export function addDaysToKey(key: LondonDateKey, days: number): LondonDateKey {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export type PeriodWindow = { start: Date; endExclusive: Date };

export type MonthPeriod = {
  key: string;
  label: string;
  window: PeriodWindow;
};

export function monthPeriodFor(key: LondonDateKey): MonthPeriod {
  const [year, month] = key.split("-").map(Number);
  const startKey = `${year}-${pad2(month)}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  const start = startOfLondonDay(startKey);
  const endExclusive = startOfLondonDay(nextMonth);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { key: `${year}-${pad2(month)}`, label, window: { start, endExclusive } };
}

export function currentLondonMonthKey(now: Date): string {
  const parts = londonParts(now);
  return `${parts.year}-${pad2(parts.month)}`;
}

export function lastCompletedMonthPeriod(now: Date): MonthPeriod {
  const previous = new Date(now.getTime() - 1);
  const parts = londonParts(previous);
  const firstOfCurrent = startOfLondonDay(`${parts.year}-${pad2(parts.month)}-01`);
  if (firstOfCurrent.getTime() <= now.getTime()) {
    const prevMonthDate = new Date(Date.UTC(parts.year, parts.month - 1, 1) - 1);
    return monthPeriodFor(londonDateKey(prevMonthDate));
  }
  return monthPeriodFor(`${parts.year}-${pad2(parts.month)}`);
}

export function isWindowComplete(window: PeriodWindow, now: Date): boolean {
  return window.endExclusive.getTime() <= now.getTime();
}

export function blockWindowFromConfig(config: { blockStart: string; blockEnd: string }): PeriodWindow {
  return {
    start: startOfLondonDay(config.blockStart),
    endExclusive: startOfLondonDay(addDaysToKey(config.blockEnd, 1)),
  };
}
