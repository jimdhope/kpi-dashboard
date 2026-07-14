import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, getSessionCookieSecret } from "@/server/auth/config";
import { hashSessionToken } from "@/server/auth/session-cookie";
import { sessionRepository } from "@/server/repositories/session-repository";
import type { NavResource } from "@/lib/contracts";
import { permissionService } from "@/server/services/permission-service";

const PUBLIC_ROUTES = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = new Set(["/api/auth/"]);

// Page routes requiring manage-level on a specific resource
const PAGE_GUARDS: Array<{ prefix: string; resource: string }> = [
  { prefix: "/admin", resource: "settings" },
  { prefix: "/settings", resource: "settings" },
  { prefix: "/reports", resource: "reports" },
];

// API routes requiring manage-level on a specific resource
const API_GUARDS: Array<{ prefix: string; resource: string }> = [
  { prefix: "/api/gamification/admin", resource: "settings" },
  { prefix: "/api/gamification/evaluate", resource: "miniGames" },
  { prefix: "/api/gamification/crown", resource: "miniGames" },
  { prefix: "/api/settings", resource: "settings" },
  { prefix: "/api/reports", resource: "reports" },
  { prefix: "/api/integrations", resource: "integrations" },
];

function signToken(token: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

function getTokenFromCookie(cookieValue: string | undefined, secret: string): string | null {
  if (!cookieValue) return null;
  const [token, signature] = cookieValue.split(".");
  if (!token || !signature) return null;
  const expected = signToken(token, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;
  return token;
}

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

  // Allow public routes
  if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  // Validate session cookie
  const secret = getSessionCookieSecret();
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const token = getTokenFromCookie(cookieValue, secret);

  if (!token) {
    return deny(pathname, request, 401, "Unauthorized");
  }

  // Look up session in DB (includes user with roles)
  const session = await sessionRepository.findByTokenHash(hashSessionToken(token));

  if (!session || session.expiresAt <= new Date()) {
    return deny(pathname, request, 401, "Unauthorized");
  }

  const userRoles = session.user.userRoles.map((ur) => ur.role.key) as string[];

  // Check page guards — require MANAGE on the resource
  for (const guard of PAGE_GUARDS) {
    if (pathname === guard.prefix || pathname.startsWith(guard.prefix + "/")) {
      const hasAccess = await permissionService.hasNavAccess(userRoles, guard.resource as NavResource, "MANAGE");
      if (!hasAccess) {
        return NextResponse.redirect(new URL("/agent", request.url));
      }
    }
  }

  // Check API guards — require MANAGE on the resource
  for (const guard of API_GUARDS) {
    if (pathname.startsWith(guard.prefix)) {
      const hasAccess = await permissionService.hasNavAccess(userRoles, guard.resource as NavResource, "MANAGE");
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // Block non-admins from mutating users (POST/PUT/DELETE on /api/users)
  const isAdmin = await permissionService.hasEffectiveAdminAccess(userRoles);
  if (pathname.startsWith("/api/users") && pathname !== "/api/users/me") {
    if (request.method !== "GET" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/agent/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/competitions/:path*",
    "/trackers/:path*",
    "/performance/:path*",
    "/directory/:path*",
    "/knowledge-base/:path*",
    "/reports/:path*",
    "/mini-games/:path*",
    "/tools/:path*",
    "/team-leader/:path*",
    "/pod-manager/:path*",
    "/call-flow/:path*",
    "/meter-reading-guide/:path*",
    "/api/:path*",
  ],
};
