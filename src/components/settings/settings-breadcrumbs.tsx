"use client";

import {
  Calendar,
  Database,
  Hash,
  Megaphone,
  MessageSquare,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";

const settingsMenuItems = [
  { label: "General & Backup", href: "/settings/general", icon: Settings },
  { label: "Data Import", href: "/settings/data-import", icon: Database },
  { label: "Hashtag Scores", href: "/settings/score-targets", icon: Hash },
  { label: "Teams", href: "/settings/teams/channels", icon: MessageSquare },
  { label: "Automations", href: "/settings/teams/automations", icon: Zap },
  { label: "Scheduled", href: "/settings/teams/scheduled", icon: Calendar },
  { label: "Campaigns", href: "/settings/campaigns", icon: Megaphone },
  { label: "Pods", href: "/settings/pods", icon: ShieldCheck },
  { label: "Users", href: "/settings/users", icon: Users },
  { label: "Permissions", href: "/settings/permissions", icon: Shield },
];

export function SettingsBreadcrumbs() {
  return (
    <Breadcrumbs
      sectionItems={settingsMenuItems}
      className="sticky top-[65px] z-40 border-b bg-background/95 backdrop-blur-sm md:hidden"
    />
  );
}
