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
  setting("campaigns", "Campaigns", "Manage campaigns", "/settings/campaigns", Megaphone, "settings.campaigns"),
  setting("pods", "Pods", "Manage pods and memberships", "/settings/pods", ShieldCheck, "settings.pods"),
  setting("users", "Users", "Manage users and roles", "/settings/users", Users, "settings.users"),
  setting("permissions", "Permissions", "Configure role permissions", "/settings/permissions", Shield, "settings.permissions", "MANAGE"),
];

const teamsSettings = [
  setting("hashtag-scores", "Hashtags", "Configure Teams hashtag scoring", "/settings/score-targets", Hash, "integrations.hashtags"),
  setting("teams-channels", "Channels", "Manage Microsoft Teams endpoints", "/settings/teams/channels", MessageSquare, "integrations.channels"),
  setting("teams-workflows", "Workflows", "Create event-driven Teams workflows", "/settings/teams/workflows", Zap, "integrations.workflows"),
  setting("teams-scheduled", "Scheduled", "Manage recurring Teams messages", "/settings/teams/scheduled", Calendar, "integrations.scheduled"),
];

export const SETTINGS_NAVIGATION_GROUPS: SettingsNavigationGroup[] = [
  setting("profile", "Profile", "Manage your account and install KPI Quest", "/settings/profile", UserCircle),
  setting("backup-restore", "Backup & Restore", "Back up, restore, or import application data", "/settings/general", Database, "settings.backup", "MANAGE"),
  { ...setting("users-group", "Users", "Manage organisation structure and access", "/settings/users", Users), children: userSettings },
  { ...setting("teams-group", "Teams", "Manage Microsoft Teams integrations", "/settings/teams/channels", MessageSquare), children: teamsSettings },
];

export const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = SETTINGS_NAVIGATION_GROUPS.flatMap(
  (item) => item.children ?? [item],
);
