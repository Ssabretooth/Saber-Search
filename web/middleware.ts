import { type NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/', '/login', '/admin/login', '/terms', '/about', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('sb-auth-token')?.value;

  if (publicRoutes.includes(pathname)) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|static|public).*)'],
};
