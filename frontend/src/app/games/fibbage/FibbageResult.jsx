"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { play } from "../../../lib/sound/soundManager.js";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { podiumEnter, sectionEnter } from "../../../lib/fibbage/motion.js";
import { Avatar } from "../../../components/Avatar.jsx";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";
import { FibbageButton } from "./components/FibbageButton.jsx";
import { FibbageGameStats } from "./components/FibbageGameStats.jsx";

const PODIUM_COLORS = ["var(--fibbage-gold)", "var(--fibbage-accent)", "var(--fibbage-cta)"];
const PODIUM_LABELS = ["1st", "2nd", "3rd"];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-14"];
const PODIUM_ORDER = [1, 0, 2];
const CONFETTI_COLORS = ["#ffd966", "#b8a3ff", "#ff7d70", "#4fdcd1", "#ff85c0"];

/**
 * @param {{ reduce: boolean }} props
 */
function ConfettiBurst({ reduce }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 280,
        y: -(Math.random() * 200 + 80),
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.3,
      })),
    [],
  );

  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="fibbage-particle"
          style={{ backgroundColor: p.color, left: "50%", top: "40%" }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{
            opacity: [1, 1, 0],
            x: p.x,
            y: p.y,
            rotate: p.rotate,
            scale: [1, 0.6],
          }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function FibbageResult() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const { room, localUserId, socketError, returnToLobby, leaveRoom } = useFibbage();
  const [returnPending, setReturnPending] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [error, setError] = useState(null);

  const game = room?.game;
  const players = room?.players ?? [];
  const isHost = localUserId === room?.hostUserId;
  const displayError = error ?? socketError ?? null;

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const winnerUserId = sorted[0]?.userId ?? null;
  const sessionSummary = game?.sessionSummary ?? null;
  const viewerSessionStat = game?.viewerSessionStat ?? null;
  const pageMotion = sectionEnter(reduce, 0);
  const isViewerWinner = localUserId === winnerUserId;

  useEffect(() => {
    play("win");
  }, []);

  const handleReturnToLobby = useCallback(async () => {
    if (returnPending) return;
    setReturnPending(true);
    setError(null);
    try {
      const result = await returnToLobby();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not return to lobby.");
        setReturnPending(false);
      }
    } catch {
      setError("Could not return to lobby.");
      setReturnPending(false);
    }
  }, [returnToLobby, returnPending]);

  const handleLeave = useCallback(async () => {
    if (leavePending) return;
    setLeavePending(true);
    setError(null);
    try {
      const result = await leaveRoom();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not leave room.");
        setLeavePending(false);
        return;
      }
      router.replace(FIBBAGE_PATHS.entry);
    } catch {
      setError("Could not leave room.");
      setLeavePending(false);
    }
  }, [leaveRoom, router, leavePending]);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center px-4 py-12">
      <ConfettiBurst reduce={reduce} />
      <motion.div className="relative z-10 w-full max-w-lg space-y-8" {...pageMotion}>
        <header className="text-center">
          <p className="fibbage-eyebrow text-[var(--fibbage-gold)]">Championship</p>
          <h1 className="mt-2 text-3xl font-black fibbage-title-gradient sm:text-4xl">Game Over</h1>
          <p className="mt-2 fibbage-body">
            {isViewerWinner
              ? "You are the champion of deception!"
              : "The champion of deception has been crowned"}
          </p>
        </header>

        <div className="flex items-end justify-center gap-3 sm:gap-5">
          {PODIUM_ORDER.map((podiumIdx) => {
            const player = podium[podiumIdx];
            if (!player) {
              return <div key={`empty-${podiumIdx}`} className="w-24" />;
            }
            return (
              <motion.div
                key={player.userId}
                className="flex w-24 flex-col items-center gap-2"
                {...podiumEnter(podiumIdx, reduce)}
              >
                <div
                  className={`rounded-full p-1 ${podiumIdx === 0 && !reduce ? "fibbage-winner-glow" : ""}`}
                  style={{
                    boxShadow: podiumIdx === 0 ? `0 0 24px ${PODIUM_COLORS[0]}40` : "none",
                    border: `2px solid ${PODIUM_COLORS[podiumIdx]}`,
                  }}
                >
                  <Avatar
                    username={player.username}
                    avatarUrl={player.avatarUrl}
                    avatarEmoji={player.avatarEmoji}
                    size={podiumIdx === 0 ? "lg" : "md"}
                  />
                </div>
                <span className="max-w-full truncate text-sm font-bold text-[var(--fibbage-text)]" title={player.username}>
                  {player.username}
                </span>
                <span
                  className="text-xs font-black uppercase"
                  style={{ color: PODIUM_COLORS[podiumIdx] }}
                >
                  {PODIUM_LABELS[podiumIdx]}
                </span>
                <div
                  className={`fibbage-podium-pedestal w-full ${PODIUM_HEIGHTS[podiumIdx]} flex items-center justify-center`}
                >
                  <span className="fibbage-score-pop text-lg">{player.score ?? 0}</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {rest.length > 0 ? (
          <div className="space-y-2">
            {rest.map((player, i) => (
              <motion.div
                key={player.userId}
                className="flex items-center gap-3 rounded-lg bg-[var(--fibbage-canvas-light)] px-4 py-2.5"
                initial={reduce ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 0.6 + i * 0.08 }}
              >
                <span className="w-6 text-center text-sm font-bold text-[var(--fibbage-text-muted)]">
                  {i + 4}
                </span>
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size="sm"
                />
                <span className="flex-1 text-sm font-semibold text-[var(--fibbage-text)]">
                  {player.username}
                </span>
                <span className="text-sm font-bold text-[var(--fibbage-text-muted)]">
                  {player.score ?? 0}
                </span>
              </motion.div>
            ))}
          </div>
        ) : null}

        <FibbageGameStats
          summary={sessionSummary}
          players={players}
          viewerSessionStat={viewerSessionStat}
          winnerUserId={winnerUserId}
        />

        <motion.div
          className="flex flex-col gap-3 sm:flex-row sm:justify-center"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.2, duration: 0.3 }}
        >
          {isHost ? (
            <FibbageButton className="rounded-full" pending={returnPending} onClick={handleReturnToLobby}>
              {returnPending ? "Returning…" : "Play Again"}
            </FibbageButton>
          ) : null}
          <FibbageButton variant="secondary" className="rounded-full" pending={leavePending} onClick={handleLeave}>
            {leavePending ? "Leaving…" : "Leave"}
          </FibbageButton>
        </motion.div>

        {!isHost ? (
          <p className="text-center fibbage-micro">
            Waiting for host to start a new game…
          </p>
        ) : null}

        {displayError ? (
          <p className="text-center text-sm font-semibold text-[var(--fibbage-lie)]">{displayError}</p>
        ) : null}
      </motion.div>
    </div>
  );
}
