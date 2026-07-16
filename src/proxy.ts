import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isMobileUserAgent(ua: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get('user-agent') || '';
  const cookieLayout = request.cookies.get('eleva_layout')?.value;

  const prefereMobile = cookieLayout === 'mobile' || (!cookieLayout && isMobileUserAgent(ua));
  const prefereDesktop = cookieLayout === 'desktop';

  if (pathname === '/portal') {
    if (prefereMobile && !prefereDesktop) {
      return NextResponse.redirect(new URL('/portal/mobile', request.url));
    }
  }

  if (pathname === '/portal/mobile' && prefereDesktop) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  if (pathname === '/') {
    if (prefereMobile && !prefereDesktop) {
      return NextResponse.redirect(new URL('/mobile', request.url));
    }
  }

  if (pathname === '/mobile' && prefereDesktop) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
