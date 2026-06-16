"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { TabooGameOver } from "./components/TabooGameOver.jsx";
import { TabooPage } from "./components/TabooPage.jsx";
import { tabooPath } from "./taboo-shared.js";

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
    <TabooPage maxWidth="sm" stagger={false} className="min-h-[70dvh] items-center justify-center py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <TabooGameOver
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
          <p className="mt-3 text-center text-sm font-semibold text-taboo-danger-text">{rematchError}</p>
        ) : null}
      </motion.div>
    </TabooPage>
  );
}
