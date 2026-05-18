"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { GameBoard } from "../components/GameBoard.jsx";
import { GameEndPanel } from "../components/GameEndPanel.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { LetterKeyboard } from "../components/LetterKeyboard.jsx";
import { RoomCodeChip } from "../components/RoomCodeChip.jsx";
import { ScoreRail } from "../components/ScoreRail.jsx";
import { TurnBanner } from "../components/TurnBanner.jsx";
import { WordPickerPanel } from "../components/WordPickerPanel.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
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
    connectionState,
    socketError,
    isSyncing,
    scoreRows,
    activePlayer,
    localUserId,
    permissions,
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

  const phaseLabel = phase ? PHASE_LABELS[phase] ?? phase : "";
  const setterName =
    room?.players?.find((p) => p.userId === game?.setterUserId)?.username ?? "Setter";

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
    <HangmanShell
      connected={connected}
      connectionState={connectionState}
      socketError={socketError}
      isSyncing={isSyncing}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 pb-12 lg:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          {room?.code ? (
            <div className="flex justify-center lg:justify-start">
              <RoomCodeChip code={room.code} size="md" />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
              {error}
            </p>
          ) : null}

          {phase === "setter_pick" && permissions.canRandomizePreview ? (
            <WordPickerPanel
              preview={game?.wordPreview ?? null}
              busy={!connected}
              onRandomize={() => void randomizePreview()}
              onSubmit={(w) => void submitWord(w)}
            />
          ) : null}

          {phase === "setter_pick" && !permissions.canRandomizePreview ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-muted-bright/30 px-5 py-4 text-center text-sm font-bold text-foreground/75"
            >
              {setterName} is choosing a word
              {previewDots ? (
                <span className="mt-2 block font-mono text-2xl tracking-widest text-primary">{previewDots}</span>
              ) : null}
            </motion.p>
          ) : null}

          {(phase === "guessing" || phase === "round_end") && game ? (
            <GameBoard
              maskedWord={game.maskedWord ?? ""}
              wrongCount={game.wrongGuessCount ?? 0}
              phaseLabel={phaseLabel}
              roundNumber={game.roundNumber ?? 1}
            />
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
              <div className="rounded-2xl border border-foreground/10 bg-muted-bright/15 p-4">
                <p className="mb-3 text-xs font-black uppercase text-foreground/55">Letters</p>
                <div className="flex flex-wrap gap-2 text-sm font-bold">
                  <span className="text-accent-mint">✓ {(game?.guessedLetters ?? []).join(", ") || "—"}</span>
                  <span className="text-error">✗ {(game?.wrongLetters ?? []).join(", ") || "—"}</span>
                </div>
              </div>
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
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-foreground/10 bg-background/95 p-5"
            >
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
            </motion.section>
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
      </div>
    </HangmanShell>
  );
}
