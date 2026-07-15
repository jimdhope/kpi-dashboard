import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, getSessionCookieSecret } from "@/server/auth/config";
import { hashSessionToken } from "@/server/auth/session-cookie";
import { sessionRepository } from "@/server/repositories/session-repository";
import type { NavResource, PermissionLevel } from "@/lib/contracts";
import {
  getApiPermissionRequirement,
  getPagePermissionRequirement,
  permissionLevelSatisfies,
  SAFE_METHODS,
} from "@/server/security/authorization-policy";

const PUBLIC_ROUTES = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = new Set([
  "/api/auth/",
  // External Teams callbacks authenticate with their high-entropy endpoint ID.
  "/api/integrations/teams/incoming/",
]);

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
  minLevel: Exclude<PermissionLevel, "NONE">,
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
  return permissionLevelSatisfies(granted, minLevel);
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
  const pageGuard = getPagePermissionRequirement(pathname);
  if (pageGuard && !hasSessionNavAccess(session, pageGuard.resource, pageGuard.minLevel)) {
    return NextResponse.redirect(new URL("/agent", request.url));
  }

  // Check API guards. Safe reads and mutations can require different levels.
  const apiGuard = getApiPermissionRequirement(pathname, request.method);
  if (apiGuard && !hasSessionNavAccess(session, apiGuard.resource, apiGuard.minLevel)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
