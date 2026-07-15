import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, getSessionCookieSecret } from "@/server/auth/config";
import { hashSessionToken } from "@/server/auth/session-cookie";
import { sessionRepository } from "@/server/repositories/session-repository";
import type { NavResource } from "@/lib/contracts";
import { permissionService } from "@/server/services/permission-service";

const PUBLIC_ROUTES = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = new Set([
  "/api/auth/",
  // External Teams callbacks authenticate with their high-entropy endpoint ID.
  "/api/integrations/teams/incoming/",
]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Order specific write/manage destinations before their view-level parents.
const PAGE_GUARDS: Array<{ prefix: string; resource: NavResource; minLevel: "VIEW" | "MANAGE" }> = [
  { prefix: "/competitions/manage", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/competitions/log", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/competitions/certificates", resource: "competitions", minLevel: "MANAGE" },
  { prefix: "/performance/kpis", resource: "performance", minLevel: "MANAGE" },
  { prefix: "/performance/log", resource: "performance", minLevel: "MANAGE" },
  { prefix: "/admin", resource: "settings", minLevel: "MANAGE" },
  { prefix: "/settings", resource: "settings", minLevel: "MANAGE" },
  { prefix: "/reports", resource: "reports", minLevel: "VIEW" },
  { prefix: "/competitions", resource: "competitions", minLevel: "VIEW" },
  { prefix: "/performance", resource: "performance", minLevel: "VIEW" },
  { prefix: "/knowledge-base", resource: "knowledgeBase", minLevel: "VIEW" },
  { prefix: "/directory", resource: "directory", minLevel: "VIEW" },
  { prefix: "/mini-games", resource: "miniGames", minLevel: "VIEW" },
  { prefix: "/tools", resource: "usefulTools", minLevel: "VIEW" },
  { prefix: "/call-flow", resource: "usefulTools", minLevel: "VIEW" },
  { prefix: "/meter-reading-guide", resource: "usefulTools", minLevel: "VIEW" },
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

  // Reject browser cross-site mutations before any application handler runs.
  if (!SAFE_METHODS.has(request.method)) {
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

  // Check page guards using the same resource and level shown in navigation.
  for (const guard of PAGE_GUARDS) {
    if (pathname === guard.prefix || pathname.startsWith(guard.prefix + "/")) {
      const hasAccess = await permissionService.hasNavAccess(userRoles, guard.resource, guard.minLevel);
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
  if (pathname.startsWith("/api/users") && pathname !== "/api/users/me") {
    const isAdmin = await permissionService.hasEffectiveAdminAccess(userRoles);
    if (request.method !== "GET" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}
