"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { GameOverScreen } from "./taboo-shared.js";

/**
 * @param {{ room: object }} props
 */
export function TabooResult({ room }) {
  const router = useRouter();
  const { leaveRoom } = useTaboo();
  const game = room?.game;

  return (
    <motion.div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <GameOverScreen
        game={game}
        players={room?.players}
        onLeave={async () => {
          await leaveRoom();
          router.push("/games/taboo");
        }}
      />
    </motion.div>
  );
}
