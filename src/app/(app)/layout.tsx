import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  const canUseManagementView = await permissionService.hasEffectiveAdminAccess(session.user.roles);

  return (
    <AuthenticatedShell user={session.user} preview={session.preview} navVariant={canUseManagementView ? "default" : "agent"}>
      {children}
    </AuthenticatedShell>
  );
}
