"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../lib/notifications/NotificationsContext.jsx";
import { useFocusTrap } from "../../lib/a11y/useFocusTrap.js";
import { NotificationsPanel } from "./NotificationsPanel.jsx";

export function NotificationsNavButton() {
  const { enabled, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const reduceMotion = useReducedMotion();

  useFocusTrap(open, panelRef, { onEscape: () => setOpen(false) });

  useEffect(() => {
    if (!open) return undefined;
    void markAllRead();
    const onPointerDown = (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, markAllRead]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        type="button"
        whileHover={reduceMotion ? undefined : { scale: 1.05 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-pink px-1 text-[10px] font-black text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-background/40 backdrop-blur-[2px] sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-1/2 top-[calc(4.75rem+env(safe-area-inset-top))] z-[60] w-[min(100vw-1.25rem,32rem)] -translate-x-1/2 origin-top sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(100vw-2rem,32rem)] sm:translate-x-0"
            >
              <NotificationsPanel onClose={() => setOpen(false)} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
