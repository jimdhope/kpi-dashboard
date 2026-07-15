import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, getSessionCookieSecret } from "@/server/auth/config";
import { hashSessionToken } from "@/server/auth/session-cookie";
import { sessionRepository } from "@/server/repositories/session-repository";
import type { NavResource, PermissionLevel } from "@/lib/contracts";

const PUBLIC_ROUTES = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = new Set([
  "/api/auth/",
  // External Teams callbacks authenticate with their high-entropy endpoint ID.
  "/api/integrations/teams/incoming/",
]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Order specific write/manage destinations before their view-level parents.
const PAGE_GUARDS: Array<{ prefix: string; resource: NavResource; minLevel: "VIEW" | "MANAGE" }> = [
  { prefix: "/knowledge-base/new", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/knowledge-base/categories", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/knowledge-base/tags", resource: "knowledgeBase", minLevel: "MANAGE" },
  { prefix: "/directory/contacts/new", resource: "directory", minLevel: "MANAGE" },
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

const API_GUARDS: Array<{
  prefix: string;
  pattern?: RegExp;
  resource: NavResource;
  readLevel: "VIEW" | "MANAGE";
  writeLevel: "VIEW" | "MANAGE";
}> = [
  { prefix: "/api/gamification/admin", resource: "settings", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/settings", resource: "settings", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/integrations", resource: "integrations", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/reports", resource: "reports", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/competition-rule-templates", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/competitions", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/achievements", resource: "competitions", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/kpis", resource: "performance", readLevel: "VIEW", writeLevel: "MANAGE" },
  // Performance services enforce ownership for self-service mutations.
  { prefix: "/api/performance", resource: "performance", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/directory", resource: "directory", readLevel: "VIEW", writeLevel: "MANAGE" },
  // Authenticated readers may comment and manage their own comments; route
  // handlers enforce comment ownership.
  { prefix: "", pattern: /^\/api\/kb\/articles\/[^/]+\/comments(?:\/|$)/, resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/kb/comments", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/kb/articles", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/kb/categories", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/kb/tags", resource: "knowledgeBase", readLevel: "VIEW", writeLevel: "MANAGE" },
  { prefix: "/api/mini-games", resource: "miniGames", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/rps-games", resource: "miniGames", readLevel: "VIEW", writeLevel: "VIEW" },
  { prefix: "/api/gamification/evaluate", resource: "miniGames", readLevel: "MANAGE", writeLevel: "MANAGE" },
  { prefix: "/api/gamification/crown", resource: "miniGames", readLevel: "MANAGE", writeLevel: "MANAGE" },
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

function hasSessionNavAccess(
  session: NonNullable<Awaited<ReturnType<typeof sessionRepository.findByTokenHash>>>,
  resource: NavResource,
  minLevel: PermissionLevel,
) {
  const levelOrder: PermissionLevel[] = ["NONE", "VIEW", "MANAGE"];
  const permissionResource = `nav.${resource}`;
  let granted: PermissionLevel = "NONE";
  for (const userRole of session.user.userRoles) {
    for (const permission of userRole.role.permissions) {
      if (
        permission.resource === permissionResource
        && levelOrder.indexOf(permission.level) > levelOrder.indexOf(granted)
      ) {
        granted = permission.level;
      }
    }
  }
  return levelOrder.indexOf(granted) >= levelOrder.indexOf(minLevel);
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

  // Check page guards using the same resource and level shown in navigation.
  const pagePatternGuard =
    /^\/knowledge-base\/[^/]+\/(?:edit|history)(?:\/|$)/.test(pathname)
      ? { resource: "knowledgeBase" as const, minLevel: "MANAGE" as const }
      : /^\/directory\/contacts\/[^/]+\/edit(?:\/|$)/.test(pathname)
        ? { resource: "directory" as const, minLevel: "MANAGE" as const }
        : null;
  if (pagePatternGuard) {
    const hasAccess = hasSessionNavAccess(
      session,
      pagePatternGuard.resource,
      pagePatternGuard.minLevel,
    );
    if (!hasAccess) return NextResponse.redirect(new URL("/agent", request.url));
  }

  if (!pagePatternGuard) {
    for (const guard of PAGE_GUARDS) {
      if (pathname === guard.prefix || pathname.startsWith(guard.prefix + "/")) {
        const hasAccess = hasSessionNavAccess(session, guard.resource, guard.minLevel);
        if (!hasAccess) {
          return NextResponse.redirect(new URL("/agent", request.url));
        }
        break;
      }
    }
  }

  // Check API guards. Safe reads and mutations can require different levels.
  for (const guard of API_GUARDS) {
    const matches = guard.pattern?.test(pathname)
      ?? (pathname === guard.prefix || pathname.startsWith(guard.prefix + "/"));
    if (matches) {
      const requiredLevel = SAFE_METHODS.has(request.method) ? guard.readLevel : guard.writeLevel;
      const hasAccess = hasSessionNavAccess(session, guard.resource, requiredLevel);
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      break;
    }
  }

  // Block non-admins from mutating users (POST/PUT/DELETE on /api/users)
  if (pathname.startsWith("/api/users") && pathname !== "/api/users/me") {
    const isAdmin = hasSessionNavAccess(session, "settings", "MANAGE");
    if (request.method !== "GET" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}
