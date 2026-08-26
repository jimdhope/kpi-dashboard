import { endOfDay, startOfDay } from "date-fns";

/**
 * Competition wizard date pickers return calendar-day Dates at local midnight.
 * Persist them as full local days so a competition picked to run through a
 * given date actually covers that entire day regardless of timezone.
 */
export function toCompetitionDateRange(startDate: Date, endDate: Date) {
  return {
    startsAt: startOfDay(startDate).toISOString(),
    endsAt: endOfDay(endDate).toISOString(),
  };
}
