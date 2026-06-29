import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/pods",
  "/api/auth",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get('kpiq_v3_session');
  const { pathname } = request.nextUrl;

  const isStaticAsset = pathname.startsWith('/_next') || pathname.includes('.');
  const isHome = pathname === '/';

  if (isStaticAsset) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  
  if (!sessionCookie?.value && !isHome) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (sessionCookie?.value && (isHome || pathname === '/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};