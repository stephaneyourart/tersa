import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Mode local : bypass l'authentification Supabase
  const isLocalMode = process.env.LOCAL_MODE === 'true';
  
  if (isLocalMode) {
    // En mode local, permettre l'accès direct sans auth
    // Rediriger /auth/* vers le canvas local
    if (request.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/local', request.url));
    }
    
    // Permettre l'accès à toutes les routes
    return NextResponse.next();
  }

  // Mode normal avec Supabase
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/webhooks/ (webhook endpoints)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|mp4)$).*)',
  ],
};
