"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
import { useHangmanRoom } from "../hooks/useHangmanRoom.js";
import { normalizePartyCode } from "../../../../lib/party/buildInviteUrl.js";
import { GameRulesDrawer } from "../../../../components/game/GameRulesDrawer.jsx";

export function HangmanEntryScreen() {
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get("code") ?? "";
  const normalizedInvite = inviteCodeParam ? normalizePartyCode(inviteCodeParam).slice(0, 4) : "";

  const { connected, connectionState, socketError, isSyncing } = useHangmanRoom("entry");
  const { error, createLobby, joinLobby } = useHangmanActions();
  const [joinCode, setJoinCode] = useState(normalizedInvite);
  const joinInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    if (!normalizedInvite) return;
    setJoinCode(normalizedInvite);
  }, [normalizedInvite]);

  useEffect(() => {
    if (!normalizedInvite || !joinInputRef.current) return;
    joinInputRef.current.focus();
    joinInputRef.current.select();
  }, [normalizedInvite]);

  const hasInviteLink = normalizedInvite.length > 0;

  return (
    <HangmanShell>
      <GameRulesDrawer gameId="hangman" title="How to play Hangman">
        <p>Take turns setting a word and guessing letters one at a time.</p>
        <p>Wrong guesses add to the figure — guess the word before the drawing is complete.</p>
        <p>Ready up in the lobby when everyone has joined; the host can start when all players are ready.</p>
      </GameRulesDrawer>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] border border-foreground/10 bg-gradient-to-br from-background via-muted-bright/30 to-pastel-sky/30 p-8 shadow-[var(--shadow-card)] text-center sm:text-left"
        >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Party word game</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground sm:text-6xl">Hangman</h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-foreground/70 sm:mx-0">
            Take turns setting secret words and guessing letters. Six strikes and you are out.
          </p>
        </motion.header>

        {(socketError || error) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {socketError || error}
          </p>
        )}

        <motion.div className="grid gap-5 sm:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[28px] border border-foreground/10 bg-background/95 p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="text-2xl font-black text-foreground">Create lobby</h2>
            <p className="mt-2 text-sm font-semibold text-foreground/60">Start a room and invite friends.</p>
            <Button
              variant="primary"
              className="mt-6 w-full rounded-full py-3 text-base"
              disabled={!connected}
              onClick={() => void createLobby()}
            >
              Create lobby
            </Button>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[28px] border border-foreground/10 bg-background/95 p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="text-2xl font-black text-foreground">Join lobby</h2>
            {hasInviteLink ? (
              <p className="mt-2 text-sm font-semibold text-primary">Invite link detected — code filled in below.</p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-foreground/60">Enter the 4-letter room code.</p>
            )}
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Room code</span>
              <input
                ref={joinInputRef}
                className="mt-2 w-full rounded-xl border border-foreground/15 bg-muted-bright/20 px-4 py-3 text-center font-mono text-2xl font-black uppercase tracking-[0.3em]"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(normalizePartyCode(e.target.value).slice(0, 4))}
                placeholder="ABCD"
                autoComplete="off"
              />
            </label>
            <Button
              variant="secondary"
              className="mt-5 w-full rounded-full py-3"
              disabled={!connected || joinCode.length !== 4}
              onClick={() => void joinLobby(joinCode)}
            >
              Join lobby
            </Button>
          </motion.section>
        </motion.div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
          <Link href="/games/hangman/solo">
            <Button variant="ghost">Solo practice</Button>
          </Link>
          <Link href="/games" className="text-sm font-bold text-foreground/55 hover:text-primary">
            ← All games
          </Link>
        </div>
        </div>
    </HangmanShell>
  );
}
