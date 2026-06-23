"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFriends } from "../../lib/friends/FriendsContext.jsx";
import { useFocusTrap } from "../../lib/a11y/useFocusTrap.js";
import { FriendsPanel } from "./FriendsPanel.jsx";

/**
 * @param {{ layout?: 'icon' | 'menu-row' }} [props]
 */
export function FriendsNavButton({ layout = "icon" }) {
  const { enabled, onlineCount, pendingReceivedCount } = useFriends();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const reduceMotion = useReducedMotion();

  useFocusTrap(open, panelRef, { onEscape: () => setOpen(false) });

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!enabled) return null;

  const triggerClass =
    layout === "menu-row"
      ? "relative flex w-full touch-target items-center justify-between gap-3 rounded-xl px-4 py-3 text-base font-bold text-foreground transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright/50"
      : "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted-bright/50 text-foreground shadow-sm ring-2 ring-muted-bright/30 transition-colors duration-[var(--motion-fast)] hover:bg-muted-bright";

  const triggerContent =
    layout === "menu-row" ? (
      <>
        <span className="flex items-center gap-3">
          <Users className="h-5 w-5" aria-hidden />
          Friends
        </span>
        <span className="flex items-center gap-2 text-sm font-bold text-muted">
          {onlineCount > 0 ? `${onlineCount} online` : ""}
          {pendingReceivedCount > 0 ? (
            <span className="rounded-full bg-accent-pink px-2 py-0.5 text-xs font-black text-white">
              {pendingReceivedCount}
            </span>
          ) : null}
        </span>
      </>
    ) : (
      <>
        <Users className="h-5 w-5" aria-hidden />
        {onlineCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-white shadow-sm">
            {onlineCount > 99 ? "99+" : onlineCount}
          </span>
        ) : null}
        {pendingReceivedCount > 0 ? (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent-pink ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </>
    );

  return (
    <div className={layout === "menu-row" ? "w-full" : "relative shrink-0"}>
      <motion.button
        ref={buttonRef}
        type="button"
        whileHover={reduceMotion ? undefined : { scale: layout === "menu-row" ? 1 : 1.05 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Friends${onlineCount > 0 ? `, ${onlineCount} online` : ""}`}
      >
        {triggerContent}
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
              aria-label="Friends"
              initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed left-1/2 top-[calc(4.75rem+env(safe-area-inset-top))] z-[60] w-[min(100vw-1.25rem,32rem)] -translate-x-1/2 origin-top sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(100vw-2rem,32rem)] sm:translate-x-0"
            >
              <FriendsPanel onClose={() => setOpen(false)} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
