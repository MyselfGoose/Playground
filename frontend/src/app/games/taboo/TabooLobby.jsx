"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyLobby } from "../../../components/party/PartyLobby.jsx";
import { LobbyInviteFriends } from "../../../components/party/LobbyInviteFriends.jsx";
import { ConfirmDialog } from "../../../components/taboo/ConfirmDialog.jsx";
import { StatusPill } from "../../../components/taboo/StatusPill.jsx";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { motionPresets } from "../../../lib/taboo/motion.js";
import { teamColors } from "../../../lib/taboo/variants.js";
/**
 * Lobby uses setReady → server maybeStartIfReady (TD-18: start_game socket unused).
 *
 * @param {{ room: object }} props
 */
export function TabooLobby({ room }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    connected,
    socketError,
    localUserId,
    categories,
    setReady,
    changeTeam,
    setCategories,
    leaveRoom,
    getCategories,
  } = useTaboo();

  const [error, setError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const me = useMemo(() => room?.players?.find((p) => p.id === localUserId) ?? null, [room?.players, localUserId]);
  const teamA = teamColors("A");
  const teamB = teamColors("B");
  const teamACount = room?.teams?.A?.length ?? 0;
  const teamBCount = room?.teams?.B?.length ?? 0;
  const readyCount = (room?.players ?? []).filter((p) => p.ready).length;
  const connectedCount = (room?.players ?? []).length;
  const minPlayers = 2;
  const needMore = connectedCount < minPlayers || teamACount === 0 || teamBCount === 0;

  const partyPlayers = useMemo(
    () =>
      (room?.players ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        ready: Boolean(p.ready),
        connected: p.connected !== false,
        isHost: p.id === room?.hostId,
        team: p.team,
      })),
    [room?.players, room?.hostId],
  );

  useEffect(() => {
    if (connected) void getCategories();
  }, [connected, getCategories]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(String(categories[0].categoryId));
    }
  }, [categories, selectedCategoryId]);

  async function act(action, payload) {
    const result = await action(payload);
    if (!result.ok) setError(result.error.message);
    else setError("");
  }

  const statusLine = needMore
    ? `Need players on both teams (${teamACount} Alpha · ${teamBCount} Beta)`
    : `${readyCount} of ${connectedCount} ready`;

  const startRules = needMore
    ? "Share the room code or invite link so friends can join both teams."
    : "When everyone is ready, the game starts automatically.";

  const settingsPanel = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-foreground/10 bg-background/90 p-4 shadow-sm">
        <motion.div className="flex items-center gap-4">
          <div className="flex flex-1 items-center gap-2">
            <Target className="h-4 w-4 text-foreground/45" />
            <span className="text-sm font-semibold text-foreground/60">Rounds</span>
            <span className="ml-auto text-sm font-black text-foreground">{room.settings?.roundCount}</span>
          </div>
          <motion.div className="h-4 w-px bg-foreground/10" aria-hidden />
          <div className="flex flex-1 items-center gap-2">
            <Clock className="h-4 w-4 text-foreground/45" />
            <span className="text-sm font-semibold text-foreground/60">Time</span>
            <span className="ml-auto text-sm font-black text-foreground">{room.settings?.roundDurationSeconds}s</span>
          </div>
        </motion.div>
        <motion.div className="mt-3 border-t border-foreground/10 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">Categories</p>
          <p className="text-sm font-semibold text-foreground">{room.settings?.categoryNames?.join(", ") || "All Categories"}</p>
          {room.hostId === localUserId && !room.game ? (
            <motion.div className="mt-3">
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => act(() => setCategories("all", []))}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-bold",
                    room.settings?.categoryMode === "all" ? "bg-accent-sky text-white" : "bg-muted-bright/40 text-foreground/60",
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fallback = selectedCategoryId || (categories[0] ? String(categories[0].categoryId) : "");
                    if (!fallback) return;
                    act(() => setCategories("single", [Number(fallback)]));
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-bold",
                    room.settings?.categoryMode === "single" ? "bg-accent-sky text-white" : "bg-muted-bright/40 text-foreground/60",
                  )}
                >
                  Single
                </button>
              </div>
              {room.settings?.categoryMode === "single" ? (
                <select
                  className="w-full rounded-lg border border-foreground/15 bg-muted-bright/20 px-2 py-2 text-xs font-semibold"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCategoryId(val);
                    if (val) act(() => setCategories("single", [Number(val)]));
                  }}
                >
                  {categories.map((cat) => (
                    <option key={cat.categoryId} value={cat.categoryId}>
                      {cat.category}
                    </option>
                  ))}
                </select>
              ) : null}
            </motion.div>
          ) : null}
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "rounded-xl border-2 p-3 text-left transition-all",
            me?.team === "A" ? cn(teamA.bg, teamA.border) : "border-foreground/10 bg-muted-bright/20 hover:border-foreground/20",
          )}
          onClick={() => act(changeTeam, "A")}
        >
          <div className="mb-1 flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", teamA.iconBg)}>
              <Users className={cn("h-3.5 w-3.5", teamA.iconText)} />
            </div>
            <span className="text-sm font-black">Alpha</span>
          </div>
          <p className="text-xs text-foreground/55">{teamACount} players</p>
        </button>
        <button
          type="button"
          className={cn(
            "rounded-xl border-2 p-3 text-left transition-all",
            me?.team === "B" ? cn(teamB.bg, teamB.border) : "border-foreground/10 bg-muted-bright/20 hover:border-foreground/20",
          )}
          onClick={() => act(changeTeam, "B")}
        >
          <motion.div className="mb-1 flex items-center gap-2">
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", teamB.iconBg)}>
              <Users className={cn("h-3.5 w-3.5", teamB.iconText)} />
            </div>
            <span className="text-sm font-black">Beta</span>
          </motion.div>
          <p className="text-xs text-foreground/55">{teamBCount} players</p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeamRoster
          teamLabel="Team Alpha"
          teamKey="A"
          players={room?.players ?? []}
          localUserId={localUserId}
          teamStyle={teamA}
          reduceMotion={reduceMotion}
        />
        <TeamRoster
          teamLabel="Team Beta"
          teamKey="B"
          players={room?.players ?? []}
          localUserId={localUserId}
          teamStyle={teamB}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );

  return (
    <motion.div className="min-h-dvh bg-background text-foreground">
      <PartyLobby
        gameSlug="taboo"
        code={room.code}
        header={{ gameId: "taboo", eyebrow: "Lobby" }}
        players={partyPlayers}
        localUserId={localUserId}
        startPolicy="all-ready"
        startRules={startRules}
        statusLine={statusLine}
        minPlayers={minPlayers}
        connectedCount={connectedCount}
        readyCount={readyCount}
        ready={Boolean(me?.ready)}
        onReadyToggle={() => act(setReady, !me?.ready)}
        readyDisabled={!connected || needMore}
        onLeave={() => setShowLeaveConfirm(true)}
        error={error || socketError}
        settings={
          <>
            {settingsPanel}
            {room?.code && room?.hostId && !room?.game ? (
              <LobbyInviteFriends
                gameSlug="taboo"
                roomCode={room.code}
                hostId={room.hostId}
                localUserId={localUserId ?? ""}
                playerUserIds={partyPlayers.map((p) => p.id)}
              />
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave lobby?"
        description="You'll be removed from this lobby and need the code to rejoin."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={async () => {
          await leaveRoom();
          router.push("/games/taboo");
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </motion.div>
  );
}

function TeamRoster({ teamLabel, teamKey, players, localUserId, teamStyle, reduceMotion }) {
  const roster = players.filter((p) => p.team === teamKey);
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-b to-transparent p-3", teamStyle.gradientFrom, teamStyle.borderFaint)}>
      <div className="mb-3 flex items-center gap-2">
        <motion.div className={cn("h-2 w-2 rounded-full", teamStyle.dot)} />
        <span className="text-xs font-black text-foreground">{teamLabel}</span>
      </div>
      <div className="space-y-1.5">
        <AnimatePresence>
          {roster.map((p) => (
            <motion.div
              key={p.id}
              {...(reduceMotion ? {} : motionPresets.playerItem)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg p-2.5",
                p.id === localUserId ? teamStyle.highlight : "bg-muted-bright/30",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  p.id === localUserId ? cn(teamStyle.avatarBg, "text-white") : "bg-muted-bright text-foreground/50",
                )}
              >
                {p.name?.charAt(0) || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {p.name}
                  {p.id === localUserId ? <span className="text-foreground/45"> (You)</span> : null}
                </p>
              </div>
              <StatusPill variant={p.ready ? "success" : "warning"} className="shrink-0 px-2 py-0.5 text-[10px] font-semibold">
                {p.ready ? "Ready" : "Not ready"}
              </StatusPill>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
