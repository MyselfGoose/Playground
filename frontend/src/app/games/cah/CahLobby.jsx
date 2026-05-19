"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyLobby } from "../../../components/party/PartyLobby.jsx";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";

/**
 * @param {{
 *   room: object,
 *   error: string,
 *   setError: (msg: string) => void,
 *   run: (action: () => Promise<{ ok: boolean, error?: { message: string } }>) => Promise<{ ok: boolean }>,
 * }} props
 */
export function CahLobby({ room, error, setError, run }) {
  const router = useRouter();
  const { connected, socketError, localUserId, packs, getPacks, setReady, updateSettings, startGame, leaveRoom } = useCah();

  const me = useMemo(() => room?.players?.find((p) => p.userId === localUserId) ?? null, [room?.players, localUserId]);
  const playerCount = room?.players?.length ?? 0;
  const maxSlots = Math.max(3, Number(room.settings?.maxPlayers ?? 10));
  const allReady = room.players?.every((p) => p.ready);
  const canStart = Boolean(room.permissions?.canStart) && allReady && playerCount >= 3;
  const minPlayers = 3;
  const needMore = playerCount < minPlayers;
  const readyCount = (room.players ?? []).filter((p) => p.ready).length;
  const isHost = room.hostId === localUserId;

  const serverPacks = useMemo(() => packs.map((p) => p.pack).filter(Boolean), [packs]);
  const activePacks = room.settings?.packs?.length ? room.settings.packs : serverPacks;
  const [selectedPacks, setSelectedPacks] = useState(activePacks);

  useEffect(() => {
    if (connected) void getPacks();
  }, [connected, getPacks]);

  useEffect(() => {
    const next = room.settings?.packs?.length ? room.settings.packs : serverPacks;
    setSelectedPacks(next);
  }, [room.settings?.packs, serverPacks]);

  const partyPlayers = useMemo(
    () =>
      (room.players ?? []).map((p) => ({
        id: p.userId,
        name: p.username,
        ready: Boolean(p.ready),
        connected: p.connected !== false,
        isHost: p.userId === room.hostId,
      })),
    [room.players, room.hostId],
  );

  async function togglePack(packName) {
    if (!isHost) return;
    const next = selectedPacks.includes(packName)
      ? selectedPacks.filter((p) => p !== packName)
      : [...selectedPacks, packName];
    if (next.length === 0) {
      setError("Select at least one card pack.");
      return;
    }
    setSelectedPacks(next);
    const payload = next.length === serverPacks.length ? { packs: [] } : { packs: next };
    const result = await run(() => updateSettings(payload));
    if (!result.ok) {
      setSelectedPacks(activePacks);
    }
  }

  async function selectAllPacks() {
    if (!isHost || !serverPacks.length) return;
    setSelectedPacks(serverPacks);
    await run(() => updateSettings({ packs: [] }));
  }

  const statusLine = needMore
    ? `Need at least ${minPlayers} players (${playerCount}/${minPlayers})`
    : `${readyCount} of ${playerCount} ready`;

  const settingsPanel = (
    <motion.div className="space-y-4">
      <label className="block rounded-xl bg-muted-bright/25 p-3 ring-1 ring-foreground/10">
        <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Rounds</p>
        <input
          className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
          type="number"
          min={1}
          max={20}
          value={room.settings?.maxRounds ?? 10}
          disabled={!room.permissions?.canUpdateSettings}
          onChange={(e) => run(() => updateSettings({ maxRounds: Number(e.target.value) }))}
        />
      </label>
      <motion.div className="rounded-xl bg-muted-bright/25 p-3 ring-1 ring-foreground/10">
        <motion.div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Card packs</p>
          {isHost && serverPacks.length > 0 ? (
            <button
              type="button"
              className="text-xs font-bold text-primary hover:underline"
              onClick={() => void selectAllPacks()}
            >
              Use all packs
            </button>
          ) : null}
        </motion.div>
        <p className="mt-1 text-xs font-semibold text-foreground/55">
          {selectedPacks.length === serverPacks.length || !room.settings?.packs?.length
            ? "All packs enabled"
            : `${selectedPacks.length} pack(s) selected`}
        </p>
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
          {serverPacks.length === 0 ? (
            <p className="text-sm font-semibold text-foreground/60">Loading packs…</p>
          ) : (
            serverPacks.map((packName) => (
              <label
                key={packName}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold ${
                  isHost ? "hover:bg-muted-bright/40" : "opacity-70"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-foreground/20"
                  checked={selectedPacks.includes(packName)}
                  disabled={!isHost}
                  onChange={() => void togglePack(packName)}
                />
                <span className="text-foreground">{packName}</span>
              </label>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <PartyLobby
      gameSlug="cah"
      code={room.code}
      header={{
        gameId: "cah",
        eyebrow: "Lobby",
        title: "Cards Against Humanity",
        description: "Pick packs, ready up, and start when everyone is in.",
      }}
      players={partyPlayers}
      localUserId={localUserId}
      startPolicy="host"
      startRules="Host starts when everyone is ready (minimum 3 players)."
      statusLine={statusLine}
      minPlayers={minPlayers}
      connectedCount={playerCount}
      readyCount={readyCount}
      settings={settingsPanel}
      ready={Boolean(me?.ready)}
      onReadyToggle={() => void run(() => setReady(!me?.ready))}
      readyDisabled={!connected || needMore}
      canStart={canStart}
      onStart={() =>
        void run(async () => {
          const res = await startGame();
          if (res.ok) router.push("/games/cah/play");
          return res;
        })
      }
      onLeave={() => void run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}
      error={error || socketError}
      footer={
        needMore ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
            Minimum 3 players required to start
          </p>
        ) : playerCount >= maxSlots ? (
          <p className="rounded-lg border border-foreground/15 bg-muted-bright/20 px-3 py-2 text-sm font-semibold text-foreground/75">
            Lobby is full ({playerCount}/{maxSlots}).
          </p>
        ) : null
      }
    />
  );
}
