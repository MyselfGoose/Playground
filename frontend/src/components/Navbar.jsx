"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUser } from "../lib/context/UserContext.jsx";
import { useTheme } from "../lib/theme/ThemeContext.jsx";
import { getEnabled, play, setEnabled } from "../lib/sound/soundManager.js";
import { useFocusTrap } from "../lib/a11y/useFocusTrap.js";
import { isGameImmersiveRoute } from "../lib/adaptive/deviceClass.js";
import { Avatar } from "./Avatar.jsx";
import { FriendsNavButton } from "./friends/FriendsNavButton.jsx";
import { NotificationsNavButton } from "./notifications/NotificationsNavButton.jsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const navLinkBase =
  "rounded-xl px-4 py-2 text-sm font-bold transition-[background-color,color] duration-[var(--motion-fast)]";

const iconButtonClass =
  "inline-flex h-11 w-11 shrink-0 touch-target items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright";

export function Navbar() {
  const pathname = usePathname();
  const { user, loading, logout } = useUser();
  const isAdmin = Boolean(user?.roles?.includes("admin"));
  const [open, setOpen] = useState(false);
  const menuTriggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const drawerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { isDark, toggleTheme, ready: themeReady } = useTheme();
  const reduce = useReducedMotion();
  const isImmersive = isGameImmersiveRoute(pathname ?? "/");
  const [soundEnabled, setSoundEnabled] = useState(false);

  useFocusTrap(open, drawerRef, {
    onEscape: () => {
      setOpen(false);
      menuTriggerRef.current?.focus();
    },
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setSoundEnabled(getEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) play("success");
  };

  return (
    <header
      className={`sticky top-0 z-50 overflow-x-clip border-b border-muted-bright/30 bg-background/80 shadow-sm backdrop-blur-lg pt-[env(safe-area-inset-top)] ${
        isImmersive ? "[--navbar-height:3.25rem]" : ""
      }`}
      style={{ minHeight: "var(--navbar-height)" }}
    >
      <nav className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 rounded-xl px-1 py-1 text-lg font-extrabold tracking-tight text-foreground transition-opacity duration-[var(--motion-fast)] hover:opacity-90"
        >
          <Image
            src="/brand/playground-mark.svg"
            alt=""
            width={40}
            height={40}
            className={`shrink-0 ${isImmersive ? "h-8 w-8" : "h-10 w-10"}`}
            priority
          />
          <span className="hidden sm:inline md:inline">Playground</span>
        </Link>

        <div
          className={`hidden min-w-0 justify-center md:flex ${isImmersive ? "md:!hidden" : ""}`}
        >
          <div className="flex items-center gap-1">
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
            {isAdmin ? (
              <Link
                href="/admin"
                className={`${navLinkBase} ${
                  pathname.startsWith("/admin")
                    ? "bg-primary-dark text-white shadow-[var(--shadow-play)]"
                    : "text-foreground hover:bg-muted-bright/50 hover:text-primary"
                }`}
              >
                Admin
              </Link>
            ) : null}
          </div>
        </div>

        {/* Actions — one grid cell; CSS switches mobile vs desktop toolbar */}
        <div className="flex shrink-0 items-center justify-end">
          {/* Desktop / tablet toolbar — hidden below md (768px) */}
          <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <span
              className="inline-flex h-10 min-w-[5rem] items-center justify-center rounded-xl bg-muted-bright/50 px-4 text-sm font-bold text-muted"
              aria-label="Loading session"
            >
              …
            </span>
          ) : user ? (
            <>
              <NotificationsNavButton />
              <FriendsNavButton />
              <Link
                href="/profile"
                className="flex touch-target items-center gap-2 rounded-xl py-1 pl-1 pr-3 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              >
                <Avatar
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                  avatarEmoji={user.avatarEmoji}
                  size="sm"
                />
                <span className="hidden max-w-[8rem] truncate text-sm font-bold text-foreground lg:inline">
                  {user.username}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="hidden touch-target rounded-xl px-3 py-2 text-sm font-bold text-muted underline-offset-4 transition-colors duration-[var(--motion-fast)] hover:text-primary hover:underline xl:inline-flex"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className={`${navLinkBase} text-foreground ring-2 ring-muted-bright hover:bg-muted-bright/50`}
              >
                Register
              </Link>
              <Link
                href="/login"
                className={`${navLinkBase} bg-primary-dark text-white shadow-[var(--shadow-play)] hover:brightness-95`}
              >
                Login
              </Link>
            </>
          )}

          <motion.button
            type="button"
            onClick={toggleSound}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            className={iconButtonClass}
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
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            className={iconButtonClass}
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
          </div>

          {/* Mobile toolbar — only avatar + menu below md */}
          <div className="flex items-center gap-1.5 md:hidden">
          {loading ? (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted-bright/50 text-sm font-bold text-muted"
              aria-label="Loading session"
            >
              …
            </span>
          ) : user ? (
            <Link
              href="/profile"
              className="flex shrink-0 touch-target items-center rounded-xl p-1 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              aria-label={`Profile, ${user.username}`}
            >
              <Avatar
                username={user.username}
                avatarUrl={user.avatarUrl}
                avatarEmoji={user.avatarEmoji}
                size="sm"
              />
            </Link>
          ) : null}

          <button
            ref={menuTriggerRef}
            type="button"
            className={iconButtonClass}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-xl leading-none">{open ? "×" : "≡"}</span>
          </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-nav-drawer"
            ref={drawerRef}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            className="overflow-hidden border-t border-muted-bright/30 bg-background/95 md:hidden"
          >
            <div className="flex max-h-[min(70dvh,28rem)] flex-col gap-1 overflow-y-auto px-4 py-3">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="touch-target rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                >
                  {label}
                </Link>
              ))}
              <Link
                id="feedback-trigger-mobile"
                href="/feedback"
                onClick={() => setOpen(false)}
                className="touch-target rounded-xl px-4 py-3 text-left text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              >
                Feedback
              </Link>
              {isAdmin ? (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="touch-target rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                >
                  Admin
                </Link>
              ) : null}

              {!loading && user ? (
                <>
                  <NotificationsNavButton layout="menu-row" />
                  <FriendsNavButton layout="menu-row" />
                </>
              ) : null}

              <button
                type="button"
                onClick={toggleSound}
                className="flex touch-target items-center justify-between rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                aria-pressed={soundEnabled}
              >
                <span>Sound effects</span>
                <span aria-hidden>{soundEnabled ? "On" : "Off"}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex touch-target items-center justify-between rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
              >
                <span>Theme</span>
                <span aria-hidden>{themeReady ? (isDark ? "Dark" : "Light") : "…"}</span>
              </button>

              {!loading && !user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="touch-target rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="touch-target rounded-xl px-4 py-3 text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
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
                    className="touch-target rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="touch-target rounded-xl px-4 py-3 text-left text-base font-bold text-muted transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
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
