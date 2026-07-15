import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { authService } from "@/server/services/auth-service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");
  if (!session.user.roles.includes("admin")) redirect("/agent");

  return (
    <AuthenticatedShell user={session.user} showCommandPalette={false}>
      {children}
    </AuthenticatedShell>
  );
}
