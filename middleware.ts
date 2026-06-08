import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import { isStaffRole } from './lib/auth';
import { resolveTenantSlug } from './lib/tenant-host';

const SKIP_REWRITE_PREFIXES = [
  '/api',
  '/auth',
  '/_next',
  '/favicon.ico',
  '/forgot-password',
  '/reset-password',
];

function requiresStaffAuth(pathname: string): boolean {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/api/admin');
}

function applyTenantRewrite(
  request: NextRequest,
  slug: string,
  pathname: string
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = `/${slug}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set('x-tenant-slug', slug);
  return response;
}

function shouldRewrite(slug: string | null, pathname: string): slug is string {
  return !!slug && !SKIP_REWRITE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') ?? '';
  const slug = resolveTenantSlug(host);

  if (
    pathname.startsWith('/api/admin/cron') ||
    pathname.startsWith('/api/admin/tenants') ||
    pathname.startsWith('/api/admin/provision')
  ) {
    return NextResponse.next();
  }

  if (!slug && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  let response = shouldRewrite(slug, pathname)
    ? applyTenantRewrite(request, slug, pathname)
    : NextResponse.next({ request });

  if (!requiresStaffAuth(pathname)) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = shouldRewrite(slug, pathname)
            ? applyTenantRewrite(request, slug, pathname)
            : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (!isStaffRole(profile?.role)) {
    await supabase.auth.signOut();
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (slug && profile?.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', profile.tenant_id)
      .maybeSingle();

    if (tenant?.slug && tenant.slug !== slug) {
      await supabase.auth.signOut();
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
