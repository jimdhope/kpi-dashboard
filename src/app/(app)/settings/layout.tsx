import { redirect } from "next/navigation";
import { SettingsBreadcrumbs } from "@/components/settings/settings-breadcrumbs";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  const hasAccess = await permissionService.hasNavAccess(session.user.roles, "settings", "VIEW");
  if (!hasAccess) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <SettingsBreadcrumbs />
      <div className="flex-1">{children}</div>
    </div>
  );
}
