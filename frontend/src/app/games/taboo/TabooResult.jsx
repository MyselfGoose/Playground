"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { ResultGate } from "../../../components/game-feel/WinnerBanner.jsx";
import {
  GameOverScreen,
  tabooPath,
  tabooWinnerBannerSubtitle,
  tabooWinnerBannerTitle,
} from "./taboo-shared.js";

/**
 * @param {{ room: object }} props
 */
export function TabooResult({ room }) {
  const router = useRouter();
  const { leaveRoom, returnToLobby, localUserId } = useTaboo();
  const game = room?.game;
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState(/** @type {string | null} */ (null));

  const isHost = Boolean(localUserId && room?.hostId === localUserId);

  const handlePlayAgain = async () => {
    if (!isHost) return;
    setRematchBusy(true);
    setRematchError(null);
    const result = await returnToLobby();
    setRematchBusy(false);
    if (!result.ok) {
      const err = result.error;
      setRematchError(err instanceof Error ? err.message : "Could not return to lobby");
      return;
    }
    router.push(tabooPath("/games/taboo", room?.code));
  };

  return (
    <motion.div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <ResultGate
        title={tabooWinnerBannerTitle(game)}
        subtitle={tabooWinnerBannerSubtitle(game)}
      >
        <GameOverScreen
          game={game}
          players={room?.players}
          showInRoomRematch={isHost}
          playAgainDisabled={rematchBusy}
          onPlayAgain={() => void handlePlayAgain()}
          onLeave={async () => {
            await leaveRoom();
            router.push("/games/taboo");
          }}
        />
        {rematchError ? (
          <p className="mt-3 text-center text-sm font-semibold text-red-600">{rematchError}</p>
        ) : null}
      </ResultGate>
    </motion.div>
  );
}
