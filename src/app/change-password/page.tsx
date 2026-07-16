import { redirect } from "next/navigation";
import { ForcedPasswordChange } from "@/components/profile/forced-password-change";
import { authService } from "@/server/services/auth-service";

export default async function ChangePasswordPage() {
  const session = await authService.getCurrentSession();
  if (!session.user) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");

  return <ForcedPasswordChange />;
}
