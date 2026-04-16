"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "../../lib/context/UserContext.jsx";
import { Avatar } from "../../components/Avatar.jsx";

export default function ProfilePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const search = searchParams.toString();
      const next = `${pathname}${search ? `?${search}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, pathname, searchParams]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Loading your session…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">
        Redirecting to login…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-12 text-center sm:py-16">
      <Avatar username={user.username} src={user.avatarUrl} size="lg" />
      <h1 className="mt-6 text-3xl font-extrabold text-ink sm:text-4xl">{user.username}</h1>
      <p className="mt-2 text-ink-muted">{user.email}</p>
      <p className="mt-1 text-sm text-ink-muted">Your player card (stats coming soon)</p>

      <div className="mt-10 grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Games played", value: "—" },
          { label: "Points", value: "—" },
          { label: "Rank", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[var(--radius-xl)] bg-white/80 px-4 py-5 shadow-[var(--shadow-card)] ring-2 ring-white/80"
          >
            <p className="text-2xl font-extrabold text-ink">{stat.value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <Link
        href="/games"
        className="mt-10 text-sm font-bold text-accent underline-offset-4 hover:underline"
      >
        Back to games
      </Link>
    </div>
  );
}
