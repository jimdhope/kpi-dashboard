import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { SAFE_METHODS } from "@/server/security/authorization-policy";
import { ADMIN_PREVIEW_COOKIE } from "@/server/auth/admin-preview-token";

const PUBLIC_ROUTES = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = new Set([
  "/api/auth/",
  // External Teams callbacks authenticate with their high-entropy endpoint ID.
  "/api/integrations/teams/incoming/",
]);

function deny(pathname: string, request: NextRequest, status: number, message: string): NextResponse {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, { status });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Reject browser cross-site mutations before any application handler runs.
  if (!SAFE_METHODS.has(request.method)) {
    if (request.cookies.has(ADMIN_PREVIEW_COOKIE) && pathname !== "/api/admin-preview") {
      return NextResponse.json(
        { error: "Preview mode is read-only. Exit preview mode to make changes." },
        { status: 403 },
      );
    }
    const fetchSite = request.headers.get("sec-fetch-site");
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (fetchSite === "cross-site") {
      return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
    }
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    }
  }

  // Allow public routes
  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  // Proxy performs only the fast optimistic cookie check. Services and Route
  // Handlers remain the definitive authentication and authorization boundary.
  if (!getSessionCookie(request, { cookiePrefix: "kpiq" })) {
    return deny(pathname, request, 401, "Unauthorized");
  }

  return NextResponse.next();
}
