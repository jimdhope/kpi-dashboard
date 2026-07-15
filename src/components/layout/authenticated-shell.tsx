import type { ReactNode } from "react";
import type { AppUser } from "@/lib/contracts";
import { AppNavBar, type NavItemConfig } from "@/components/app-navbar";
import { CommandPalette } from "@/components/command-palette";
import { OfflineIndicator } from "@/components/offline-indicator";
import { permissionService } from "@/server/services/permission-service";

interface AuthenticatedShellProps {
  children: ReactNode;
  user: AppUser;
  items?: NavItemConfig[];
  showCommandPalette?: boolean;
}

export async function AuthenticatedShell({
  children,
  user,
  items,
  showCommandPalette = true,
}: AuthenticatedShellProps) {
  const permissions = await permissionService.getPermissionsForRoles(user.roles);

  return (
    <div className="min-h-screen">
      <AppNavBar user={user} items={items} initialPermissions={permissions} />
      <OfflineIndicator />
      {showCommandPalette ? <CommandPalette /> : null}
      <main className="px-4 pb-6 md:px-6">{children}</main>
    </div>
  );
}
