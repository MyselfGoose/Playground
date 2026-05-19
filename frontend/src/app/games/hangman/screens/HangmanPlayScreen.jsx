"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { GameFeedbackOverlay } from "../../../../components/feedback/GameFeedbackOverlay.jsx";
import { GameBoard } from "../components/GameBoard.jsx";
import { GameEndPanel } from "../components/GameEndPanel.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { LetterKeyboard } from "../components/LetterKeyboard.jsx";
import { PartyCode } from "../../../../components/party/PartyCode.jsx";
import { ScoreRail } from "../components/ScoreRail.jsx";
import { TurnBanner } from "../components/TurnBanner.jsx";
import { WordPickerPanel } from "../components/WordPickerPanel.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
import { useHangmanLetterFeedback } from "../hooks/useHangmanLetterFeedback.js";
import { useHangmanRoom } from "../hooks/useHangmanRoom.js";

const PHASE_LABELS = {
  setter_pick: "Word selection",
  guessing: "Guessing",
  round_end: "Round recap",
  game_end: "Final scores",
};

export function HangmanPlayScreen() {
  const {
    room,
    game,
    phase,
    connected,
    socketError,
    scoreRows,
    activePlayer,
    localUserId,
    permissions,
    roomNotice,
    clearRoomNotice,
  } = useHangmanRoom("play");
  const {
    error,
    randomizePreview,
    submitWord,
    guessLetter,
    nextRound,
    playAgain,
    returnToLobby,
    leaveToMenu,
  } = useHangmanActions();

  const [guessLock, setGuessLock] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!roomNotice) return;
    const t = setTimeout(() => clearRoomNotice?.(), 5000);
    return () => clearTimeout(t);
  }, [roomNotice, clearRoomNotice]);

  const feedbackVariant = useHangmanLetterFeedback({
    wrongCount: game?.wrongGuessCount ?? 0,
    guessed: game?.guessedLetters,
    wrong: game?.wrongLetters,
    enabled: phase === "guessing",
  });

  const phaseLabel = phase ? PHASE_LABELS[phase] ?? phase : "";
  const setterName =
    room?.players?.find((p) => p.userId === game?.setterUserId)?.username ?? "Setter";
  const isHost = room?.hostId === localUserId;

  const previewDots = useMemo(() => {
    const len = game?.previewLength ?? 0;
    if (!len) return "";
    return "•".repeat(len);
  }, [game?.previewLength]);

  async function handleGuess(letter) {
    if (guessLock || !permissions.canGuess) return;
    setGuessLock(true);
    try {
      await guessLetter(letter);
    } finally {
      setGuessLock(false);
    }
  }

  return (
    <HangmanShell>
      <GameFeedbackOverlay variant={feedbackVariant} reduceMotion={reduceMotion} />
      <motion.div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 pb-12 lg:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          {room?.code ? (
            <div className="flex justify-center lg:justify-start">
              <PartyCode code={room.code} gameSlug="hangman" size="sm" />
            </div>
          ) : null}

          {roomNotice ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground"
            >
              {roomNotice}
            </p>
          ) : null}

          {error || socketError ? (
            <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
              {error || socketError}
            </p>
          ) : null}

          {phase === "setter_pick" && permissions.canRandomizePreview ? (
            <Card variant="elevated" className="p-0">
              <WordPickerPanel
                preview={game?.wordPreview ?? null}
                busy={!connected}
                secondsRemaining={game?.setterSecondsRemaining}
                onRandomize={() => void randomizePreview()}
                onSubmit={(w) => void submitWord(w)}
              />
            </Card>
          ) : null}

          {phase === "setter_pick" && !permissions.canRandomizePreview ? (
            <Card variant="elevated" className="text-center">
              <p className="text-sm font-bold text-foreground/75">
                {setterName} is choosing a word
                {typeof game?.setterSecondsRemaining === "number" && game.setterSecondsRemaining > 0
                  ? ` (${game.setterSecondsRemaining}s)`
                  : ""}
              </p>
              {previewDots ? (
                <p className="mt-2 font-mono text-2xl tracking-widest text-primary">{previewDots}</p>
              ) : null}
            </Card>
          ) : null}

          {(phase === "guessing" || phase === "round_end") && game ? (
            <Card variant="elevated" className="p-0">
              <GameBoard
                maskedWord={game.maskedWord ?? ""}
                wrongCount={game.wrongGuessCount ?? 0}
                phaseLabel={phaseLabel}
                roundNumber={game.roundNumber ?? 1}
              />
            </Card>
          ) : null}

          {phase === "guessing" && activePlayer ? (
            <TurnBanner
              activeUsername={activePlayer.username}
              isMyTurn={Boolean(game?.isMyTurn)}
              secondsRemaining={game?.turnSecondsRemaining}
            />
          ) : null}

          {phase === "guessing" ? (
            <>
              <Card variant="elevated" className="py-4">
                <p className="mb-3 text-xs font-black uppercase text-foreground/55">Letters</p>
                <div className="flex flex-wrap gap-2 text-sm font-bold">
                  <span className="text-accent-mint">✓ {(game?.guessedLetters ?? []).join(", ") || "—"}</span>
                  <span className="text-error">✗ {(game?.wrongLetters ?? []).join(", ") || "—"}</span>
                </div>
              </Card>
              <LetterKeyboard
                guessed={game?.guessedLetters}
                wrong={game?.wrongLetters}
                disabled={!connected || guessLock}
                waiting={!game?.isMyTurn}
                onLetter={(l) => void handleGuess(l)}
              />
            </>
          ) : null}

          {phase === "round_end" ? (
            <Card variant="elevated">
              <p className="text-lg font-black capitalize text-foreground">
                Round over — {game?.lastOutcome}
              </p>
              <p className="mt-2 font-mono text-xl font-bold text-primary">Word: {game?.revealedWord ?? "—"}</p>
              {permissions.canNextRound ? (
                <Button className="mt-4" variant="primary" onClick={() => void nextRound()}>
                  Next round
                </Button>
              ) : (
                <p className="mt-3 text-sm font-semibold text-foreground/60">Waiting for host to continue…</p>
              )}
              {permissions.canReturnToLobby && !isHost ? (
                <Button className="mt-3 w-full" variant="secondary" onClick={() => void returnToLobby()}>
                  Back to lobby
                </Button>
              ) : null}
            </Card>
          ) : null}

          {phase === "game_end" ? (
            <GameEndPanel
              scoreRows={scoreRows}
              busy={!connected}
              onPlayAgain={() => void playAgain()}
              onReturnToLobby={() => void returnToLobby()}
              onLeave={() => void leaveToMenu()}
            />
          ) : null}
        </div>

        {phase !== "game_end" ? <ScoreRail rows={scoreRows} /> : null}
      </motion.div>
    </HangmanShell>
  );
}
