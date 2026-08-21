import "server-only";

import { divisionRepository } from "@/server/repositories/division-repository";
import { appSettingService } from "@/server/services/app-setting-service";
import { parseLeagueConfig } from "@/server/services/division-config";
import {
  blockWindowFromConfig,
  isWindowComplete,
  lastCompletedMonthPeriod,
} from "@/server/services/division-periods";
import { crownMonthlyChampions } from "@/server/services/division-title-service";
import { commitReshuffle } from "@/server/services/division-reshuffle-service";
import { teamsEventService } from "@/server/services/teams-event-service";

export type MaintenanceRunSummary = {
  skipped: boolean;
  reason?: string;
  crownedLeagues: number;
  reshuffledLeagues: number;
  announcementsQueued: number;
};

function divisionEmoji(division: string): string {
  if (division === "PREMIER") return "🥇";
  if (division === "CHAMPIONSHIP") return "🥈";
  return "🥉";
}

async function queueAnnouncement(input: {
  webhookIds: string[];
  title: string;
  text: string;
}): Promise<number> {
  if (input.webhookIds.length === 0) return 0;
  await teamsEventService.queueDeliveries({
    webhookIds: input.webhookIds,
    title: input.title,
    text: input.text,
  });
  return input.webhookIds.length;
}

export async function runDivisionMaintenance(): Promise<MaintenanceRunSummary> {
  const settings = await appSettingService.getDivisionsSettings();
  if (!settings.enabled) {
    return {
      skipped: true,
      reason: "Divisions feature is disabled",
      crownedLeagues: 0,
      reshuffledLeagues: 0,
      announcementsQueued: 0,
    };
  }

  const now = new Date();
  const leagues = await divisionRepository.listActiveLeagues();
  const summary: MaintenanceRunSummary = {
    skipped: false,
    crownedLeagues: 0,
    reshuffledLeagues: 0,
    announcementsQueued: 0,
  };

  const monthPeriod = lastCompletedMonthPeriod(now);

  for (const league of leagues) {
    const config = parseLeagueConfig(league.configJson);
    const blockWindow = blockWindowFromConfig(config);

    const monthInSeason =
      monthPeriod.window.start.getTime() >= blockWindow.start.getTime() &&
      monthPeriod.window.endExclusive.getTime() <= blockWindow.endExclusive.getTime();

    if (monthInSeason && isWindowComplete(monthPeriod.window, now)) {
      try {
        const result = await crownMonthlyChampions({ leagueId: league.id });
        const fresh = result.crowned.filter((title) => !title.alreadyRecorded);
        if (fresh.length > 0) {
          summary.crownedLeagues += 1;
          if (settings.teamsAnnouncementEnabled) {
            const lines = fresh.map(
              (title) =>
                `${divisionEmoji(title.division)} ${title.division}: ${title.userName ?? "Unknown"} (${title.points} pts)`,
            );
            summary.announcementsQueued += await queueAnnouncement({
              webhookIds: settings.teamsWebhookIds,
              title: `🏆 ${config.cupName} — ${result.periodLabel} champions`,
              text: lines.join("\n"),
            });
          }
        }
      } catch (error) {
        console.error(`divisions: monthly crowning failed for ${league.name}`, error);
      }
    }

    if (blockWindow.endExclusive.getTime() <= now.getTime()) {
      try {
        const { plan, alreadyApplied } = await commitReshuffle({ leagueId: league.id });
        if (!alreadyApplied) {
          summary.reshuffledLeagues += 1;
          if (settings.teamsAnnouncementEnabled) {
            const lines: string[] = [];
            for (const winner of plan.blockWinners) {
              lines.push(
                `${divisionEmoji(winner.division)} ${winner.division} champion: ${winner.userName ?? "Unknown"} (${winner.points} pts)`,
              );
            }
            for (const promotion of plan.promotions) {
              lines.push(`⬆️ ${promotion.userName ?? "Unknown"} promoted to ${promotion.toDivision}`);
            }
            for (const relegation of plan.relegations) {
              lines.push(`⬇️ ${relegation.userName ?? "Unknown"} relegated to ${relegation.toDivision}`);
            }
            summary.announcementsQueued += await queueAnnouncement({
              webhookIds: settings.teamsWebhookIds,
              title: `📣 ${plan.cupName} — reshuffle complete`,
              text: lines.join("\n"),
            });
          }
        }
      } catch (error) {
        console.error(`divisions: reshuffle failed for ${league.name}`, error);
      }
    }
  }

  return summary;
}
