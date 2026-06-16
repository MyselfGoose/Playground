"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../lib/context/UserContext.jsx";
import { useTheme } from "../lib/theme/ThemeContext.jsx";
import { getEnabled, play, setEnabled } from "../lib/sound/soundManager.js";
import { Avatar } from "./Avatar.jsx";
import { FriendsNavButton } from "./friends/FriendsNavButton.jsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const navLinkBase =
  "rounded-xl px-4 py-2 text-sm font-bold transition-[background-color,color] duration-[var(--motion-fast)]";

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useUser();
  const [open, setOpen] = useState(false);
  const { isDark, toggleTheme, ready: themeReady } = useTheme();
  const [soundEnabled, setSoundEnabled] = useState(() =>
    typeof window !== "undefined" ? getEnabled() : false,
  );

  const toggleSound = () => {
    const next = !soundEnabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) play("success");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-muted-bright/30 shadow-sm pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-xl px-2 py-1 text-lg font-extrabold tracking-tight text-foreground transition-opacity duration-[var(--motion-fast)] hover:opacity-90"
        >
          <Image
            src="/brand/playground-mark.svg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0"
            priority
          />
          <span className="hidden sm:inline">Playground</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`${navLinkBase} ${
                  active
                    ? "bg-primary-dark text-white shadow-[var(--shadow-play)]"
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
            className={`${navLinkBase} text-foreground hover:bg-muted-bright/50 hover:text-primary`}
          >
            Feedback
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <span
              className="inline-flex h-10 min-w-[5rem] items-center justify-center rounded-xl bg-muted-bright/50 px-4 text-sm font-bold text-muted"
              aria-label="Loading session"
            >
              …
            </span>
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <FriendsNavButton />
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-3 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              >
                <Avatar username={user.username} src={user.avatarUrl} size="sm" />
                <span className="hidden max-w-[8rem] truncate text-sm font-bold text-foreground sm:inline">
                  {user.username}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl px-3 py-2 text-xs font-bold text-muted underline-offset-4 transition-colors duration-[var(--motion-fast)] hover:text-primary hover:underline"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className={`hidden sm:inline ${navLinkBase} text-foreground ring-2 ring-muted-bright hover:bg-muted-bright/50`}
              >
                Register
              </Link>
              <Link
                href="/login"
                className={`${navLinkBase} bg-primary-dark text-white shadow-[var(--shadow-play)] hover:brightness-95`}
              >
                Login
              </Link>
            </div>
          )}

          <motion.button
            type="button"
            onClick={toggleSound}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright"
            aria-label={soundEnabled ? "Sound effects on" : "Sound effects off"}
            aria-pressed={soundEnabled}
            suppressHydrationWarning
          >
            <span className="text-lg" suppressHydrationWarning>
              {soundEnabled ? "🔊" : "🔇"}
            </span>
          </motion.button>

          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright"
            aria-label={
              themeReady
                ? isDark
                  ? "Switch to light mode"
                  : "Switch to dark mode"
                : "Switch theme"
            }
            suppressHydrationWarning
          >
            <span className="text-lg" suppressHydrationWarning>
              {themeReady ? (isDark ? "☀️" : "🌙") : "🌙"}
            </span>
          </motion.button>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright md:hidden"
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
                  className="rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                >
                  {label}
                </Link>
              ))}
              <Link
                id="feedback-trigger-mobile"
                href="/feedback"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-left text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              >
                Feedback
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggleSound();
                }}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                aria-pressed={soundEnabled}
              >
                <span>Sound effects</span>
                <span aria-hidden>{soundEnabled ? "On" : "Off"}</span>
              </button>
              {!loading && !user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
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
                    className="rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="rounded-xl px-4 py-3 text-left text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
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
