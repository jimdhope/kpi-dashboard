import type { ComponentType } from "react";
import {
  Calendar,
  Database,
  Hash,
  Megaphone,
  MessageSquare,
  Shield,
  ShieldCheck,
  UserCircle,
  Users,
  Zap,
  Sparkles,
} from "lucide-react";

export interface SettingsNavigationItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permissionKey: string;
  requiredLevel: "VIEW" | "MANAGE";
}

export interface SettingsNavigationGroup extends SettingsNavigationItem {
  children?: SettingsNavigationItem[];
}

const setting = (
  id: string,
  label: string,
  description: string,
  href: string,
  icon: SettingsNavigationItem["icon"],
  permissionKey = "settings",
  requiredLevel: "VIEW" | "MANAGE" = "VIEW",
): SettingsNavigationItem => ({ id, label, description, href, icon, permissionKey, requiredLevel });

const userSettings = [
  setting("people-overview", "People overview", "People, structure and absences", "/settings/people", Users, "settings.users"),
  setting("campaigns", "Campaigns", "Manage campaigns", "/settings/campaigns", Megaphone, "settings.campaigns"),
  setting("pods", "Pods", "Manage pods and memberships", "/settings/pods", ShieldCheck, "settings.pods"),
  setting("absences", "Absences", "Record and review date-range absences", "/settings/users/absences", Calendar, "settings.users", "MANAGE"),
  setting("permissions", "Permissions", "Configure role permissions", "/settings/permissions", Shield, "settings.permissions", "MANAGE"),
];

const teamsSettings = [
  setting("hashtag-scores", "Hashtags", "Configure Teams hashtag scoring", "/settings/score-targets", Hash, "integrations.hashtags"),
  setting("teams-channels", "Channels", "Manage Microsoft Teams endpoints", "/settings/teams/channels", MessageSquare, "integrations.channels"),
  setting("teams-workflows", "Workflows", "Create event-driven Teams workflows", "/settings/teams/workflows", Zap, "integrations.workflows"),
  setting("teams-scheduled", "Scheduled", "Manage recurring Teams messages", "/settings/teams/scheduled", Calendar, "integrations.scheduled"),
];

const generalSettings = [
  setting("motd", "MOTD", "Publish Message of the Day", "/settings/general/motd", Megaphone, "settings.announcements", "MANAGE"),
  setting("feedback", "Feedback", "Review feedback submissions", "/settings/general/feedback", MessageSquare, "settings.feedback", "MANAGE"),
  setting("meme-match", "Meme Match", "Manage GIF game prompts", "/settings/meme-match", Sparkles, "miniGames.manage", "MANAGE"),
  setting("meme-match-rooms", "Meme Match games", "Inspect and moderate games", "/settings/meme-match/rooms", Sparkles, "miniGames.manage", "MANAGE"),
  setting("quiz-show", "Quiz Show", "Manage Quiz Show questions and quizzes", "/settings/quiz-show", Sparkles, "miniGames.quizManage", "MANAGE"),
  setting("quiz-show-rooms", "Quiz Show rooms", "View and delete Quiz Show rooms", "/settings/quiz-show/rooms", Sparkles, "miniGames.quizManage", "MANAGE"),
];

export const SETTINGS_NAVIGATION_GROUPS: SettingsNavigationGroup[] = [
  setting("profile", "Profile", "Manage your account and install KPI Quest", "/settings/profile", UserCircle),
  { ...setting("general", "General", "Announcements, backups, restore, and import", "/settings/general", Database, "settings", "VIEW"), children: generalSettings },
  { ...setting("users-group", "People", "Manage people, structure and access", "/settings/people", Users), children: userSettings },
  { ...setting("teams-group", "Teams", "Manage Microsoft Teams integrations", "/settings/teams/channels", MessageSquare), children: teamsSettings },
];

export const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = SETTINGS_NAVIGATION_GROUPS.flatMap(
  (item) => item.children ?? [item],
);
