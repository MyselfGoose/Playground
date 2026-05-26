"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { PageHeader } from "../../../../components/PageHeader.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { GameRulesDrawer } from "../../../../components/game/GameRulesDrawer.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
import { useHangmanRoom } from "../hooks/useHangmanRoom.js";
import { normalizePartyCode } from "../../../../lib/party/buildInviteUrl.js";
import { RejoinRoomPrompt } from "../../../../components/party/RejoinRoomPrompt.jsx";
import { clearLastRoomCode, readLastRoomCode } from "../../../../lib/session/RoomSession.js";

export function HangmanEntryScreen() {
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get("code") ?? "";
  const normalizedInvite = inviteCodeParam ? normalizePartyCode(inviteCodeParam).slice(0, 4) : "";

  const { connected, socketError, room } = useHangmanRoom("entry");
  const lastRoomCode = readLastRoomCode("hangman");
  const showRejoin = connected && lastRoomCode && !room?.code;
  const { error, createLobby, joinLobby } = useHangmanActions();
  const [joinCode, setJoinCode] = useState(normalizedInvite);
  const joinInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const createSectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));

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

  function scrollToCreate() {
    createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <HangmanShell>
      <GameRulesDrawer gameId="hangman" title="How to play Hangman">
        <p>Take turns setting a secret word and guessing letters one at a time.</p>
        <p>
          Each round, one player is the <strong>setter</strong> and picks a word; everyone else guesses.
          The setter role rotates each round.
        </p>
        <p>Wrong guesses add to the figure — guess the word before six wrong letters.</p>
        <p>Ready up in the lobby when everyone has joined; all ready starts a short countdown.</p>
      </GameRulesDrawer>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader gameId="hangman" align="left" />

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" className="rounded-full px-6" disabled={!connected} onClick={scrollToCreate}>
            Play with friends
          </Button>
          <Link href="/games/hangman/solo">
            <Button variant="secondary" className="rounded-full">
              Solo practice
            </Button>
          </Link>
        </div>

        {showRejoin ? (
          <RejoinRoomPrompt
            roomCode={lastRoomCode}
            lobbyHref="/games/hangman/lobby"
            onRejoin={() => void joinLobby(lastRoomCode)}
            onLeave={() => clearLastRoomCode("hangman")}
          />
        ) : null}

        {(socketError || error) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {socketError || error}
          </p>
        )}

        <motion.div ref={createSectionRef} className="grid gap-5 sm:grid-cols-2">
          <Card variant="elevated">
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
          </Card>

          <Card variant="elevated">
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
          </Card>
        </motion.div>

        <Link href="/games" className="text-sm font-bold text-foreground/55 hover:text-primary">
          ← All games
        </Link>
      </div>
    </HangmanShell>
  );
}
