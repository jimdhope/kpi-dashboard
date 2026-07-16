import type { ReactNode } from "react";
import type { AppUser } from "@/lib/contracts";
import { AppNavBar, type NavVariant } from "@/components/app-navbar";
import { CommandPalette } from "@/components/command-palette";
import { OfflineIndicator } from "@/components/offline-indicator";
import { permissionService } from "@/server/services/permission-service";
import { PwaInstallHint } from "@/components/pwa/pwa-install-hint";

interface AuthenticatedShellProps {
  children: ReactNode;
  user: AppUser;
  navVariant?: NavVariant;
  showCommandPalette?: boolean;
}

export async function AuthenticatedShell({
  children,
  user,
  navVariant,
  showCommandPalette = true,
}: AuthenticatedShellProps) {
  const permissions = await permissionService.getPermissionsForRoles(user.roles);

  return (
    <div className="min-h-screen">
      <AppNavBar user={user} navVariant={navVariant} initialPermissions={permissions} />
      <PwaInstallHint />
      <OfflineIndicator />
      {showCommandPalette ? <CommandPalette /> : null}
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
