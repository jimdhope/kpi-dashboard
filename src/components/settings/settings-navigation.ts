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
  permissionKey: "settings";
  requiredLevel: "MANAGE";
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
): SettingsNavigationItem => ({ id, label, description, href, icon, permissionKey: "settings", requiredLevel: "MANAGE" });

const userSettings = [
  setting("campaigns", "Campaigns", "Manage campaigns", "/settings/campaigns", Megaphone),
  setting("pods", "Pods", "Manage pods and memberships", "/settings/pods", ShieldCheck),
  setting("users", "Users", "Manage users and roles", "/settings/users", Users),
  setting("permissions", "Permissions", "Configure role permissions", "/settings/permissions", Shield),
];

const teamsSettings = [
  setting("hashtag-scores", "Hashtags", "Configure Teams hashtag scoring", "/settings/score-targets", Hash),
  setting("teams-channels", "Channels", "Manage Microsoft Teams endpoints", "/settings/teams/channels", MessageSquare),
  setting("teams-workflows", "Workflows", "Create event-driven Teams workflows", "/settings/teams/workflows", Zap),
  setting("teams-scheduled", "Scheduled", "Manage recurring Teams messages", "/settings/teams/scheduled", Calendar),
];

export const SETTINGS_NAVIGATION_GROUPS: SettingsNavigationGroup[] = [
  setting("profile", "Profile", "Manage your account and install KPI Quest", "/settings/profile", UserCircle),
  setting("backup-restore", "Backup & Restore", "Back up, restore, or import application data", "/settings/general", Database),
  { ...setting("users-group", "Users", "Manage organisation structure and access", "/settings/users", Users), children: userSettings },
  { ...setting("teams-group", "Teams", "Manage Microsoft Teams integrations", "/settings/teams/channels", MessageSquare), children: teamsSettings },
];

export const SETTINGS_NAVIGATION_ITEMS: SettingsNavigationItem[] = SETTINGS_NAVIGATION_GROUPS.flatMap(
  (item) => item.children ?? [item],
);
