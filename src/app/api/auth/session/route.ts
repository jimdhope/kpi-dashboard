import { ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";

export async function GET() {
  return ok(await authService.getCurrentSession());
}
