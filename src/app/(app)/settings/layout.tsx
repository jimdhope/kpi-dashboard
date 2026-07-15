import { redirect } from "next/navigation";
import {
  Calendar,
  Database,
  Hash,
  Megaphone,
  MessageSquare,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

const settingsMenuItems = [
  { label: "General & Backup", href: "/settings/general", icon: SettingsIcon },
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

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const hasAccess = await permissionService.hasNavAccess(session.user.roles, "settings", "MANAGE");
  if (!hasAccess) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Breadcrumbs
        sectionItems={settingsMenuItems}
        className="sticky top-[65px] z-40 border-b bg-background/95 backdrop-blur-sm md:hidden"
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}
