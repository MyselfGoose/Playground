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
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-muted-bright/30 shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full px-2 py-1 text-lg font-extrabold tracking-tight text-foreground transition-transform hover:scale-105"
        >
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary via-accent-pink to-accent-purple text-lg text-white shadow-[var(--shadow-play)] group-hover:shadow-xl transition-all"
            aria-hidden
          >
            🎮
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
                className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  active
                    ? "bg-primary text-white shadow-[var(--shadow-play)]"
                    : "text-foreground hover:bg-muted-bright/50 hover:text-primary"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <Link
            id="feedback-trigger-desktop"
            href="/feedback"
            className="rounded-full px-4 py-2 text-sm font-bold text-foreground transition-all hover:bg-muted-bright/50 hover:text-primary"
          >
            Feedback
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span
              className="inline-flex h-10 min-w-[5rem] items-center justify-center rounded-full bg-muted-bright/50 px-4 text-sm font-bold text-muted"
              aria-label="Loading session"
            >
              …
            </span>
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-all hover:bg-muted-bright/50"
              >
                <Avatar username={user.username} src={user.avatarUrl} size="sm" />
                <span className="hidden max-w-[8rem] truncate text-sm font-bold text-foreground sm:inline">
                  {user.username}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-full px-3 py-2 text-xs font-bold text-muted underline-offset-4 hover:text-primary hover:underline transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="hidden rounded-full px-4 py-2 text-sm font-bold text-foreground ring-2 ring-muted-bright transition-all hover:bg-muted-bright/50 sm:inline"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-play)] transition-all hover:scale-105 active:scale-95"
              >
                Login
              </Link>
            </div>
          )}

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 md:hidden transition-all hover:bg-muted-bright"
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
            className="overflow-hidden border-t border-muted-bright/30 bg-background/80 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-3 text-base font-bold text-foreground hover:bg-muted-bright/50 transition-all"
                >
                  {label}
                </Link>
              ))}
              <Link
                id="feedback-trigger-mobile"
                href="/feedback"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-3 text-left text-base font-bold text-muted hover:bg-muted-bright/50 transition-all"
              >
                Feedback
              </Link>
              {!loading && !user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-3 text-base font-bold text-foreground hover:bg-muted-bright/50 transition-all"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-3 text-base font-bold text-muted hover:bg-muted-bright/50 transition-all"
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
                    className="rounded-full px-4 py-3 text-base font-bold text-foreground hover:bg-muted-bright/50 transition-all"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="rounded-full px-4 py-3 text-left text-base font-bold text-muted hover:bg-muted-bright/50 transition-all"
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
