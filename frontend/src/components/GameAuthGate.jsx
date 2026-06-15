"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "../lib/context/UserContext.jsx";
import { ApiError } from "../lib/api.js";
import { coordinatedRefresh } from "../lib/session/coordinatedRefresh.js";
import {
  GAME_SESSION_HOLD_MS,
  useGameSession,
} from "../lib/session/GameSessionContext.jsx";
import { findAnyLastRoomCode, readLastRoomCode } from "../lib/session/RoomSession.js";
import { LoadingSkeleton } from "./LoadingSkeleton.jsx";

/**
 * @param {string} returnUrl
 * @returns {string | null}
 */
function inviteCodeFromReturnUrl(returnUrl) {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const u = new URL(returnUrl, base);
    const code = u.searchParams.get("code");
    if (!code) return null;
    return (
      code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4) || null
    );
  } catch {
    return null;
  }
}

/**
 * @param {string} gameId
 * @param {string} returnUrl
 */
function hasPendingGameRecovery(gameId, returnUrl) {
  return Boolean(inviteCodeFromReturnUrl(returnUrl) || findAnyLastRoomCode(gameId));
}

/**
 * Auth guard for multiplayer games: keeps children mounted during session recovery
 * when the user has an active room, so sockets are not torn down mid-round.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   gameId: string,
 *   loginNext?: string,
 *   message?: string,
 * }} props
 */
export function GameAuthGate({
  children,
  gameId,
  loginNext,
  message = "Taking you to sign in…",
}) {
  const { user, loading, reconcileNow } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { beginSessionHold, endSessionHold, isWithinSessionHold, setActiveRoom } = useGameSession();
  const next = loginNext ?? pathname ?? `/games/${gameId}`;

  const hadUserRef = useRef(false);
  const recoveringRef = useRef(false);
  const recoveryStartedRef = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverySecondsLeft, setRecoverySecondsLeft] = useState(
    Math.ceil(GAME_SESSION_HOLD_MS / 1000),
  );

  useEffect(() => {
    if (user) hadUserRef.current = true;
  }, [user]);

  useEffect(() => {
    recoveringRef.current = recovering;
  }, [recovering]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (recoveringRef.current) {
        setRecovering(false);
        endSessionHold();
        recoveryStartedRef.current = false;
      }
      const code = readLastRoomCode(gameId, user.id);
      if (code) setActiveRoom(gameId, code);
      return;
    }

    const pendingRecovery = hasPendingGameRecovery(gameId, next);

    if (!pendingRecovery && !hadUserRef.current) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!pendingRecovery) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (recoveryStartedRef.current) return;
    recoveryStartedRef.current = true;
    setRecovering(true);
    beginSessionHold();

    const deadline = Date.now() + GAME_SESSION_HOLD_MS;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRecoverySecondsLeft(left);
    }, 1000);

    void (async () => {
      while (Date.now() < deadline) {
        try {
          await coordinatedRefresh();
          await reconcileNow("game_auth_recovery", { forceVisible: true });
          clearInterval(tick);
          setRecovering(false);
          endSessionHold();
          recoveryStartedRef.current = false;
          return;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      clearInterval(tick);
      setRecovering(false);
      endSessionHold();
      recoveryStartedRef.current = false;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    })();

    return () => {
      clearInterval(tick);
      endSessionHold();
    };
  }, [
    loading,
    user,
    router,
    next,
    gameId,
    beginSessionHold,
    endSessionHold,
    reconcileNow,
    setActiveRoom,
  ]);

  if (loading) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4"
        role="status"
        aria-live="polite"
      >
        <Image
          src="/brand/playground-mark.svg"
          alt=""
          width={56}
          height={56}
          className={`h-14 w-14 ${reduce ? "" : "animate-pulse opacity-90"}`}
          priority
        />
        <div className="w-full max-w-xs">
          <LoadingSkeleton variant="text" />
        </div>
        <p className="text-sm font-medium text-muted">Checking your session…</p>
      </div>
    );
  }

  if (!user && !recovering && !isWithinSessionHold()) {
    return (
      <motion.div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
        role="status"
        aria-live="polite"
      >
        <Image
          src="/brand/playground-mark.svg"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 opacity-80"
        />
        <p className="text-sm font-medium text-muted">{message}</p>
      </motion.div>
    );
  }

  if (!user && (recovering || isWithinSessionHold())) {
    return (
      <>
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 px-4 backdrop-blur-sm"
          role="alertdialog"
          aria-labelledby="session-recovery-title"
          aria-live="polite"
        >
          <Image
            src="/brand/playground-mark.svg"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 opacity-90"
          />
          <h2 id="session-recovery-title" className="text-lg font-black text-foreground">
            Restoring your session…
          </h2>
          <p className="max-w-sm text-center text-sm text-muted">
            Your game is still running. Reconnecting ({recoverySecondsLeft}s)…
          </p>
        </div>
        {children}
      </>
    );
  }

  return children;
}
