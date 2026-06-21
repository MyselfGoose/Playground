"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, MessageSquare, Menu, X, Shield, Activity, FileText } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/live", label: "Live ops", icon: Activity },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/fibbage", label: "Fibbage", icon: FileText },
];

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function AdminShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href, exact) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted hover:bg-muted-bright/30 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-muted-bright/40 px-4 py-2 text-sm font-bold"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Admin menu
        </button>
        {mobileOpen ? <div className="mt-4 rounded-2xl bg-background p-4 ring-1 ring-muted-bright/40">{nav}</div> : null}
      </div>

      <aside className="hidden w-56 shrink-0 lg:block">
        <p className="mb-4 px-4 text-xs font-bold uppercase tracking-wider text-muted">Admin</p>
        {nav}
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
