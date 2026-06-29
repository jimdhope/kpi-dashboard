"use server";

import { trackerService } from "@/server/services/tracker-service";
import { authService } from "@/server/services/auth-service";

export async function logPersonalPerformance(input: {
  trackerKpiId: string;
  value: number;
}) {
  const user = await authService.requireCurrentUser();

  return trackerService.logPerformanceEntry({
    trackerKpiId: input.trackerKpiId,
    userId: user.id,
    value: input.value,
  });
}

export async function getPerformanceOverview() {
  return trackerService.getPersonalOverview();
}
