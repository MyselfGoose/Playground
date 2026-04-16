"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../lib/context/UserContext.jsx";
import { Avatar } from "./Avatar.jsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/65 shadow-sm backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-2xl px-2 py-1 text-lg font-extrabold tracking-tight text-ink transition-transform hover:scale-[1.02]"
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-lg text-white shadow-md"
            aria-hidden
          >
            P
          </span>
          <span className="hidden sm:inline">Playground</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "bg-white text-accent shadow-sm ring-2 ring-accent/20"
                    : "text-ink-muted hover:bg-white/60 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span
              className="inline-flex h-10 min-w-[5rem] items-center justify-center rounded-2xl bg-white/60 px-4 text-sm font-bold text-ink-muted"
              aria-label="Loading session"
            >
              …
            </span>
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-2xl py-1 pl-1 pr-3 transition-colors hover:bg-white/70"
              >
                <Avatar username={user.username} src={user.avatarUrl} size="sm" />
                <span className="hidden max-w-[8rem] truncate text-sm font-bold text-ink sm:inline">
                  {user.username}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-2xl px-3 py-2 text-xs font-bold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="hidden rounded-2xl px-4 py-2 text-sm font-bold text-ink-muted ring-2 ring-ink/10 transition-colors hover:bg-white/70 sm:inline"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Login
              </Link>
            </div>
          )}

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-ink shadow-sm ring-2 ring-ink/5 md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-xl leading-none">{open ? "×" : "≡"}</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/40 bg-white/80 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-bold text-ink hover:bg-white"
                >
                  {label}
                </Link>
              ))}
              {!loading && !user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-base font-bold text-ink hover:bg-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-base font-bold text-ink-muted hover:bg-white"
                  >
                    Register
                  </Link>
                </>
              ) : null}
              {!loading && user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-base font-bold text-ink hover:bg-white"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="rounded-2xl px-4 py-3 text-left text-base font-bold text-ink-muted hover:bg-white"
                  >
                    Sign out
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
