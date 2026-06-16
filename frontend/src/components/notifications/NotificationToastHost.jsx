"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNotifications } from "../../lib/notifications/NotificationsContext.jsx";
import { Avatar } from "../Avatar.jsx";
import { Button } from "../Button.jsx";
import { Card } from "../ui/Card.jsx";

export function NotificationToastHost() {
  const { toasts, acceptInvite, declineInvite, dismissToast, enabled } = useNotifications();
  const reduceMotion = useReducedMotion();

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-[calc(4.75rem+env(safe-area-inset-top))] z-[45] flex w-[min(100vw-1.5rem,24rem)] flex-col gap-2 sm:right-4"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto"
          >
            <Card
              variant="elevated"
              className="overflow-hidden p-0 shadow-[var(--shadow-lg)] ring-1 ring-foreground/10"
            >
              <div className="border-l-4 border-primary bg-primary/5 px-3 py-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none" aria-hidden>
                    {toast.invite.gameEmoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-wide text-primary">Game invite</p>
                    <p className="mt-0.5 text-sm font-black text-foreground">{toast.invite.gameTitle}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar
                        username={toast.invite.inviter.username}
                        src={toast.invite.inviter.avatarUrl}
                        size="sm"
                      />
                      <p className="truncate text-xs font-semibold text-muted">
                        <span className="text-foreground/85">{toast.invite.inviter.username}</span> invited you
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          dismissToast(toast.id);
                          void acceptInvite(toast.invite.id);
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        variant="ghost"
                        onClick={() => {
                          dismissToast(toast.id);
                          void declineInvite(toast.invite.id);
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-muted transition-colors hover:bg-muted-bright/40 hover:text-foreground"
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
