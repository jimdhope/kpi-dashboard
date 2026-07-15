import { redirect } from "next/navigation";
import { AuthenticatedShell } from "@/components/layout/authenticated-shell";
import { authService } from "@/server/services/auth-service";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");

  return (
    <AuthenticatedShell user={session.user} navVariant="agent" showCommandPalette={false}>
      {children}
    </AuthenticatedShell>
  );
}
