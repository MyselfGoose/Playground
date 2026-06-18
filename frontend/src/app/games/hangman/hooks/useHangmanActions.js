"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useHangman } from "../../../../lib/hangman/HangmanSocketContext.jsx";

/**
 * Socket actions with inline error handling.
 */
export function useHangmanActions() {
  const router = useRouter();
  const { createRoom, joinRoom, leaveRoom, send } = useHangman();
  const [error, setError] = useState("");

  const run = useCallback(async (action) => {
    const result = await action();
    if (!result.ok) {
      setError(result.error?.message ?? "Something went wrong");
    } else {
      setError("");
    }
    return result;
  }, []);

  const createLobby = useCallback(
    () =>
      run(async () => {
        const res = await createRoom({});
        if (res.ok) router.push("/games/hangman/lobby");
        return res;
      }),
    [createRoom, run, router],
  );

  const joinLobby = useCallback(
    (code) =>
      run(async () => {
        const res = await joinRoom(code);
        if (res.ok) router.push("/games/hangman/lobby");
        return res;
      }),
    [joinRoom, run, router],
  );

  const leaveToMenu = useCallback(
    () =>
      run(async () => {
        const res = await leaveRoom();
        router.push("/games/hangman");
        return res;
      }),
    [leaveRoom, run, router],
  );

  const setReady = useCallback(
    (ready) => run(() => send("set_ready", { ready })),
    [run, send],
  );

  const randomizePreview = useCallback(
    () => run(() => send("setter_randomize_preview", {})),
    [run, send],
  );

  const submitWord = useCallback(
    (word) => run(() => send("setter_submit_word", { word: word || undefined })),
    [run, send],
  );

  const guessLetter = useCallback(
    (letter) => run(() => send("guess_letter", { letter })),
    [run, send],
  );

  const nextRound = useCallback(() => run(() => send("next_round", {})), [run, send]);

  const playAgain = useCallback(() => run(() => send("play_again", {})), [run, send]);

  const returnToLobby = useCallback(() => run(() => send("return_to_lobby", {})), [run, send]);

  return {
    error,
    setError,
    createLobby,
    joinLobby,
    leaveToMenu,
    setReady,
    randomizePreview,
    submitWord,
    guessLetter,
    nextRound,
    playAgain,
    returnToLobby,
    send,
    run,
  };
}
