import { ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";

export async function POST() {
  await authService.logout();
  return ok({ success: true });
}
