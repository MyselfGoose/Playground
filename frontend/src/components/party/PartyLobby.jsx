"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "../Button.jsx";
import { PageHeader } from "../PageHeader.jsx";
import { LeaveLobbyDialog } from "./LeaveLobbyDialog.jsx";
import { PartyCode } from "./PartyCode.jsx";
import { PlayerList } from "./PlayerList.jsx";
import { ReadyButton } from "./ReadyButton.jsx";

/**
 * @typedef {'host' | 'all-ready' | 'countdown'} StartPolicy
 */

/**
 * @param {{
 *   gameSlug: string,
 *   code?: string | null,
 *   players: import('./PlayerList.jsx').PartyPlayer[],
 *   localUserId?: string | null,
 *   startPolicy: StartPolicy,
 *   startRules: string,
 *   statusLine?: string | null,
 *   minPlayers?: number,
 *   connectedCount?: number,
 *   readyCount?: number,
 *   header?: {
 *     gameId?: string,
 *     eyebrow?: string,
 *     title?: string,
 *     description?: string,
 *     align?: 'left' | 'center',
 *   } | null,
 *   settings?: import('react').ReactNode,
 *   ready: boolean,
 *   onReadyToggle: () => void,
 *   readyDisabled?: boolean,
 *   readyPending?: boolean,
 *   canStart?: boolean,
 *   onStart?: () => void,
 *   startPending?: boolean,
 *   onLeave?: () => void | Promise<void>,
 *   leaveConfirmTitle?: string,
 *   leaveConfirmDescription?: string,
 *   error?: string | null,
 *   primaryAction?: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function PartyLobby({
  gameSlug,
  code,
  players,
  localUserId = null,
  startPolicy,
  startRules,
  statusLine = null,
  minPlayers = 2,
  connectedCount = 0,
  readyCount = 0,
  header = null,
  settings = null,
  ready,
  onReadyToggle,
  readyDisabled = false,
  readyPending = false,
  canStart = false,
  onStart,
  startPending = false,
  onLeave,
  leaveConfirmTitle,
  leaveConfirmDescription,
  error = null,
  primaryAction = null,
  footer = null,
  className = "",
}) {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const needMore = connectedCount < minPlayers;
  const resolvedStatus =
    statusLine ??
    (needMore
      ? `Waiting for players (${connectedCount}/${minPlayers} minimum)`
      : `${readyCount} of ${connectedCount} ready`);

  const showHostStart = startPolicy === "host" && typeof onStart === "function";

  async function handleConfirmLeave() {
    if (!onLeave || leaving) return;
    setLeaving(true);
    try {
      await onLeave();
      setLeaveConfirmOpen(false);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <motion.div
      className={`mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 pb-12 ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <motion.div className="min-w-0 flex-1">
          {header ? (
            <PageHeader
              gameId={header.gameId}
              eyebrow={header.eyebrow}
              title={header.title}
              description={header.description}
              align={header.align ?? "left"}
              className="!max-w-none text-left"
            />
          ) : (
            <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Lobby</p>
          )}
          {code ? <PartyCode code={code} gameSlug={gameSlug} size="lg" className="mt-3 w-full" /> : null}
        </motion.div>
        {onLeave ? (
          <Button variant="ghost" onClick={() => setLeaveConfirmOpen(true)} disabled={leaving}>
            Leave
          </Button>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <motion.div className="rounded-2xl bg-muted-bright/25 px-4 py-3 text-center">
        <p className="text-sm font-bold text-foreground">{resolvedStatus}</p>
        <p className="mt-1 text-xs font-semibold text-foreground/55">{startRules}</p>
      </motion.div>

      <PlayerList players={players} localUserId={localUserId} />

      {settings ? <motion.div className="space-y-3">{settings}</motion.div> : null}

      {primaryAction ?? (
        <>
          <ReadyButton
            ready={ready}
            onToggle={onReadyToggle}
            disabled={readyDisabled}
            pending={readyPending}
          />
          {showHostStart ? (
            <Button
              variant="primary"
              className="w-full rounded-full py-3.5 text-base font-black"
              disabled={!canStart || startPending}
              onClick={onStart}
            >
              {startPending ? "Starting…" : "Start game"}
            </Button>
          ) : null}
        </>
      )}

      {footer ? <motion.div>{footer}</motion.div> : null}

      <LeaveLobbyDialog
        open={leaveConfirmOpen}
        title={leaveConfirmTitle}
        description={leaveConfirmDescription}
        leaving={leaving}
        onConfirm={handleConfirmLeave}
        onCancel={() => setLeaveConfirmOpen(false)}
      />
    </motion.div>
  );
}
