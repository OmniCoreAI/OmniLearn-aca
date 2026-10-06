'use client';
import Link from 'next/link';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import usePortalNavVisibility from '@components/Hooks/usePortalNavVisibility';
import { usePathname, useRouter } from 'next/navigation';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getUriWithOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import { findNavItemForPath } from '@/lib/dash-nav-items';

type AuthorizationProps = {
  children: React.ReactNode;
  authorizationMode: 'component' | 'page';
};

// Paths not covered by a toggleable sidebar item (see lib/dash-nav-items.ts)
// but still admin-only regardless of per-role portal visibility settings.
const ALWAYS_ADMIN_ONLY_PATHS = ['/dash/courses'];

const AdminAuthorization: React.FC<AuthorizationProps> = ({ children, authorizationMode }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus() as any
  const { visibleItemIds, isItemVisible, loading: navLoading } = usePortalNavVisibility()
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isUserAuthenticated = useMemo(() => session.status === 'authenticated', [session.status]);

  // Whether the current pathname is authorized, given per-role portal
  // navigation visibility (falls back to the plain isAdmin boolean for
  // custom/unknown roles — see usePortalNavVisibility).
  const isPathAuthorized = useMemo(() => {
    if (ALWAYS_ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return isAdmin === true;
    }
    const item = findNavItemForPath(pathname || '');
    if (!item) return true; // uncovered route (e.g. account settings) — unchanged default-allow
    return isItemVisible(item.id);
  }, [pathname, isAdmin, isItemVisible]);

  // Whether the sidebar/dashboard shell should render at all: either the
  // legacy admin flag, or the user has at least one visible portal item
  // (e.g. an Instructor with a reduced but non-empty sidebar).
  const hasAnyPortalAccess = useMemo(() => {
    if (isAdmin) return true;
    return (visibleItemIds?.size ?? 0) > 0;
  }, [isAdmin, visibleItemIds]);

  const authorizeUser = useCallback(() => {
    if (loading || navLoading) {
      return; // Wait until admin status + portal visibility are determined
    }

    if (!isUserAuthenticated) {
      router.push(getUriWithOrg(org?.slug, '/login'));
      return;
    }

    if (authorizationMode === 'page') {
      if (isPathAuthorized) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        // Staff go back to their dashboard; people without one (learners) to the learner home.
        router.push(hasAnyPortalAccess ? '/dash' : getUriWithOrg(org?.slug, '/'));
      }
    } else if (authorizationMode === 'component') {
      setIsAuthorized(hasAnyPortalAccess);
    }
  }, [loading, navLoading, isUserAuthenticated, isPathAuthorized, hasAnyPortalAccess, authorizationMode, router, org?.slug]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (loading || navLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[hsl(var(--dash-canvas))] px-4 text-center">
        <h1 className="text-xl font-semibold text-[hsl(var(--dash-ink))]">You are not authorized to access this page</h1>
        <Link
          href={hasAnyPortalAccess ? '/dash' : getUriWithOrg(org?.slug, '/')}
          className="rounded-full bg-[hsl(var(--dash-ink))] px-5 py-2 text-sm font-semibold text-white"
        >
          {hasAnyPortalAccess ? 'Back to your dashboard' : 'Go to the homepage'}
        </Link>
      </div>
    );
  }

  return <>{isAuthorized && children}</>;
};

export default AdminAuthorization;
