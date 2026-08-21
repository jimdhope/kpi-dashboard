import "server-only";

import { cache } from "react";
import { prisma } from "@/server/db/client";

export type BeatYourBestSettings = {
  enabled: boolean;
  teamsAnnouncementEnabled: boolean;
};

export type DivisionsSettings = {
  enabled: boolean;
  teamsAnnouncementEnabled: boolean;
  dashboardCardEnabled: boolean;
  teamsWebhookIds: string[];
};

const BYB_ENABLED_KEY = "byb.enabled";
const BYB_TEAMS_ANNOUNCEMENT_ENABLED_KEY = "byb.teamsAnnouncementEnabled";

const DIVISIONS_ENABLED_KEY = "divisions.enabled";
const DIVISIONS_TEAMS_ANNOUNCEMENT_ENABLED_KEY = "divisions.teamsAnnouncementEnabled";
const DIVISIONS_DASHBOARD_CARD_ENABLED_KEY = "divisions.dashboardCardEnabled";
const DIVISIONS_TEAMS_WEBHOOK_IDS_KEY = "divisions.teamsWebhookIds";

const DEFAULT_BYB_SETTINGS: BeatYourBestSettings = {
  enabled: false,
  teamsAnnouncementEnabled: false,
};

const DEFAULT_DIVISIONS_SETTINGS: DivisionsSettings = {
  enabled: false,
  teamsAnnouncementEnabled: false,
  dashboardCardEnabled: false,
  teamsWebhookIds: [],
};

async function readBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
    const value = setting?.value;
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}

async function writeBooleanSetting(key: string, value: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function readStringListSetting(key: string, fallback: string[]): Promise<string[]> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
    const value = setting?.value;
    if (!Array.isArray(value)) return fallback;
    return value.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return fallback;
  }
}

async function writeStringListSetting(key: string, value: string[]): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export const appSettingService = {
  getBeatYourBestSettings: cache(async (): Promise<BeatYourBestSettings> => {
    const [enabled, teamsAnnouncementEnabled] = await Promise.all([
      readBooleanSetting(BYB_ENABLED_KEY, DEFAULT_BYB_SETTINGS.enabled),
      readBooleanSetting(BYB_TEAMS_ANNOUNCEMENT_ENABLED_KEY, DEFAULT_BYB_SETTINGS.teamsAnnouncementEnabled),
    ]);
    return { enabled, teamsAnnouncementEnabled };
  }),

  async updateBeatYourBestSettings(patch: Partial<BeatYourBestSettings>): Promise<BeatYourBestSettings> {
    if (typeof patch.enabled === "boolean") {
      await writeBooleanSetting(BYB_ENABLED_KEY, patch.enabled);
    }
    if (typeof patch.teamsAnnouncementEnabled === "boolean") {
      await writeBooleanSetting(BYB_TEAMS_ANNOUNCEMENT_ENABLED_KEY, patch.teamsAnnouncementEnabled);
    }
    return this.getBeatYourBestSettings();
  },

  getDivisionsSettings: cache(async (): Promise<DivisionsSettings> => {
    const [enabled, teamsAnnouncementEnabled, dashboardCardEnabled, teamsWebhookIds] =
      await Promise.all([
        readBooleanSetting(DIVISIONS_ENABLED_KEY, DEFAULT_DIVISIONS_SETTINGS.enabled),
        readBooleanSetting(
          DIVISIONS_TEAMS_ANNOUNCEMENT_ENABLED_KEY,
          DEFAULT_DIVISIONS_SETTINGS.teamsAnnouncementEnabled,
        ),
        readBooleanSetting(
          DIVISIONS_DASHBOARD_CARD_ENABLED_KEY,
          DEFAULT_DIVISIONS_SETTINGS.dashboardCardEnabled,
        ),
        readStringListSetting(DIVISIONS_TEAMS_WEBHOOK_IDS_KEY, DEFAULT_DIVISIONS_SETTINGS.teamsWebhookIds),
      ]);
    return { enabled, teamsAnnouncementEnabled, dashboardCardEnabled, teamsWebhookIds };
  }),

  async updateDivisionsSettings(patch: Partial<DivisionsSettings>): Promise<DivisionsSettings> {
    if (typeof patch.enabled === "boolean") {
      await writeBooleanSetting(DIVISIONS_ENABLED_KEY, patch.enabled);
    }
    if (typeof patch.teamsAnnouncementEnabled === "boolean") {
      await writeBooleanSetting(DIVISIONS_TEAMS_ANNOUNCEMENT_ENABLED_KEY, patch.teamsAnnouncementEnabled);
    }
    if (typeof patch.dashboardCardEnabled === "boolean") {
      await writeBooleanSetting(DIVISIONS_DASHBOARD_CARD_ENABLED_KEY, patch.dashboardCardEnabled);
    }
    if (Array.isArray(patch.teamsWebhookIds)) {
      await writeStringListSetting(
        DIVISIONS_TEAMS_WEBHOOK_IDS_KEY,
        patch.teamsWebhookIds.filter((id) => typeof id === "string"),
      );
    }
    return this.getDivisionsSettings();
  },
};
