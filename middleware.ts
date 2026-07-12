import { NextRequest } from 'next/server';
import { createClient as createSessionMiddleware } from './utils/supabase/middleware';

// Next middleware entrypoint — delegates to the supabase middleware helper which
// sets cookies returned by Supabase (session refresh) when necessary.
export function middleware(request: NextRequest) {
  return createSessionMiddleware(request);
}

export const config = {
  // Apply to all routes except Next internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
