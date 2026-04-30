import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('kpiq_v3_session');
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isPublicPage = pathname === '/';
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isStaticAsset = pathname.startsWith('/_next') || pathname.includes('.');
  const isRenderApi = pathname.startsWith('/api/render/');

  if (isStaticAsset || isAuthRoute || isRenderApi) {
    return NextResponse.next();
  }
  
  if (!sessionCookie?.value && !isLoginPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (sessionCookie?.value && (isLoginPage || isPublicPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};