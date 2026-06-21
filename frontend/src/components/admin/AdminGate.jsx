"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "../../lib/context/UserContext.jsx";
import { AdminShell } from "./AdminShell.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function AdminGate({ children }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = Boolean(user?.roles?.includes("admin"));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/");
    }
  }, [loading, user, isAdmin, router, pathname]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6" role="status">
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-muted sm:px-6" role="status">
        Checking access…
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
