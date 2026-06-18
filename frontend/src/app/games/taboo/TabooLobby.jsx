"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Copy, LogOut, Play, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LobbyInviteFriends } from "../../../components/party/LobbyInviteFriends.jsx";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { motionPresets } from "../../../lib/taboo/motion.js";
import { tabooTeamColors } from "../../../lib/taboo/variants.js";
import { TabooConfirmDialog } from "./components/TabooConfirmDialog.jsx";
import { TabooErrorBanner } from "./components/TabooErrorBanner.jsx";
import { TabooPage, TabooPageSection } from "./components/TabooPage.jsx";
import { TabooTeamTile } from "./components/TabooTeamTile.jsx";
import { TabooPlayerRow } from "./components/TabooPlayerRow.jsx";
import { TabooButton, TabooCard, TabooSelect, TabooSegmentedControl } from "./ui/index.js";

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
    localUsername,
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
  const [copied, setCopied] = useState(false);
  const [readyPending, setReadyPending] = useState(false);

  const resolvedCategoryId =
    selectedCategoryId || (categories.length > 0 ? String(categories[0].categoryId) : "");

  const me = room?.players?.find((p) => p.id === localUserId) ?? null;
  const teamA = tabooTeamColors("A");
  const teamB = tabooTeamColors("B");
  const teamACount = room?.teams?.A?.length ?? 0;
  const teamBCount = room?.teams?.B?.length ?? 0;
  const readyCount = (room?.players ?? []).filter((p) => p.ready).length;
  const connectedCount = (room?.players ?? []).length;
  const minPlayers = 2;
  const needMore = connectedCount < minPlayers || teamACount === 0 || teamBCount === 0;
  const allReady = (room?.players ?? []).every((p) => p.ready) && connectedCount > 0;
  const canStart = allReady && teamACount >= 1 && teamBCount >= 1;
  const notReadyCount = (room?.players ?? []).filter((p) => !p.ready).length;
  const anim = !reduceMotion;

  const partyPlayers = (room?.players ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    ready: Boolean(p.ready),
    connected: p.connected !== false,
    isHost: p.id === room?.hostId,
    team: p.team,
  }));

  useEffect(() => {
    if (connected) void getCategories();
  }, [connected, getCategories]);

  async function act(action, payload) {
    const result = await action(payload);
    if (!result.ok) setError(result.error.message);
    else setError("");
    return result;
  }

  async function copyCode() {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleReadyToggle() {
    setReadyPending(true);
    await act(setReady, !me?.ready);
    setReadyPending(false);
  }

  return (
    <TabooPage maxWidth="4xl" className="pb-10">
      <TabooPageSection>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            className="flex items-center gap-2 text-taboo-text-muted transition-colors hover:text-taboo-text"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">Leave</span>
          </button>
        </div>
      </TabooPageSection>

      <TabooPageSection>
        <TabooErrorBanner message={error || socketError} />
      </TabooPageSection>

      <TabooPageSection>
        <motion.section {...(anim ? motionPresets.sectionEnter(0) : {})} className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-taboo-text-faint">Lobby code</p>
          <div className="flex items-center justify-center gap-3">
            <h1 className="font-mono text-4xl font-bold tracking-[0.2em] text-taboo-text sm:text-5xl">{room.code}</h1>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-taboo-border bg-white/[0.04] transition hover:bg-white/[0.08]"
              aria-label="Copy lobby code"
            >
              {copied ? <Check className="h-4 w-4 text-taboo-success" /> : <Copy className="h-4 w-4 text-taboo-text-muted" />}
            </button>
          </div>
          <p className="mt-2 text-sm text-taboo-text-faint">
            {localUsername || "Player"} · Share this code with friends
          </p>
        </motion.section>
      </TabooPageSection>

      <TabooPageSection>
        <TabooCard level={1} className="p-4">
          <div className="mb-3 flex items-center gap-4">
            <div className="flex flex-1 items-center gap-2">
              <Target className="h-4 w-4 text-taboo-text-faint" />
              <span className="text-sm text-taboo-text-muted">Rounds</span>
              <span className="ml-auto text-sm font-bold text-taboo-text">{room.settings?.roundCount}</span>
            </div>
            <div className="h-4 w-px bg-taboo-border" aria-hidden />
            <div className="flex flex-1 items-center gap-2">
              <Clock className="h-4 w-4 text-taboo-text-faint" />
              <span className="text-sm text-taboo-text-muted">Time</span>
              <span className="ml-auto text-sm font-bold text-taboo-text">{room.settings?.roundDurationSeconds}s</span>
            </div>
          </div>
          <div className="border-t border-taboo-border pt-3">
            <p className="mb-1 text-xs text-taboo-text-faint">Categories</p>
            <p className="text-sm font-medium text-taboo-text">
              {room.settings?.categoryNames?.join(", ") || "All Categories"}
            </p>
            {room.hostId === localUserId && !room.game ? (
              <div className="mt-3 space-y-2">
                <TabooSegmentedControl
                  size="sm"
                  value={room.settings?.categoryMode === "all" ? "all" : "single"}
                  onChange={(mode) => {
                    if (mode === "all") {
                      void act(() => setCategories("all", []));
                      return;
                    }
                    const fallback = resolvedCategoryId;
                    if (!fallback) return;
                    void act(() => setCategories("single", [Number(fallback)]));
                  }}
                  options={[
                    { value: "all", label: "All" },
                    { value: "single", label: "Single" },
                  ]}
                />
                {room.settings?.categoryMode === "single" ? (
                  <TabooSelect
                    value={resolvedCategoryId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCategoryId(val);
                      if (val) void act(() => setCategories("single", [Number(val)]));
                    }}
                    selectClassName="h-10 text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.category}
                      </option>
                    ))}
                  </TabooSelect>
                ) : null}
              </div>
            ) : null}
          </div>
        </TabooCard>
      </TabooPageSection>

      {room?.code && room?.hostId && !room?.game ? (
        <TabooPageSection>
          <TabooCard level={1} className="p-4">
            <LobbyInviteFriends
              gameSlug="taboo"
              roomCode={room.code}
              hostId={room.hostId}
              localUserId={localUserId ?? ""}
              playerUserIds={partyPlayers.map((p) => p.id)}
            />
          </TabooCard>
        </TabooPageSection>
      ) : null}

      <TabooPageSection>
        <TabooCard level={1} className="p-4 sm:p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-taboo-text-muted">Choose team</p>
          <p className="mb-5 text-xs text-taboo-text-muted">Switching teams will mark you Not Ready.</p>

          <div className="mb-5 grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
            <TabooTeamTile
              teamLabel="Alpha"
              team="A"
              playerCount={teamACount}
              selected={me?.team === "A"}
              onSelect={() => act(changeTeam, "A")}
            />
            <TabooTeamTile
              teamLabel="Beta"
              team="B"
              playerCount={teamBCount}
              selected={me?.team === "B"}
              onSelect={() => act(changeTeam, "B")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 [&>*]:min-w-0">
            <TeamRoster
              teamLabel="Team Alpha"
              teamKey="A"
              players={room?.players ?? []}
              localUserId={localUserId}
              teamStyle={teamA}
              hostId={room?.hostId}
            />
            <TeamRoster
              teamLabel="Team Beta"
              teamKey="B"
              players={room?.players ?? []}
              localUserId={localUserId}
              teamStyle={teamB}
              hostId={room?.hostId}
            />
          </div>
        </TabooCard>
      </TabooPageSection>

      <TabooPageSection className="space-y-3">
        <TabooButton
          variant={me?.ready ? "success" : "ghost"}
          loading={readyPending}
          disabled={!connected || needMore}
          onClick={() => void handleReadyToggle()}
        >
          {me?.ready ? "Ready! Tap to unready" : "Mark as Ready"}
        </TabooButton>

        <TabooButton variant="ghost" disabled className="opacity-60">
          <Play className="h-4 w-4" />
          {canStart
            ? "Starting game…"
            : needMore
              ? `Need players on both teams (${teamACount} Alpha · ${teamBCount} Beta)`
              : `Waiting for ${notReadyCount} player(s)…`}
        </TabooButton>
        <p className="text-center text-xs text-taboo-text-faint">
          {needMore
            ? "Share the room code so friends can join both teams."
            : `${readyCount} of ${connectedCount} ready · game starts when everyone is ready`}
        </p>
      </TabooPageSection>

      <TabooConfirmDialog
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
    </TabooPage>
  );
}

function TeamRoster({ teamLabel, teamKey, players, localUserId, teamStyle, hostId }) {
  const roster = players.filter((p) => p.team === teamKey);
  const isTeamA = teamKey === "A";

  return (
    <div
      className={cn(
        "flex min-h-[160px] min-w-0 flex-col rounded-xl p-3",
        isTeamA ? "taboo-roster-panel-a" : "taboo-roster-panel-b",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("h-2 w-2 shrink-0 rounded-full", teamStyle.dot)} />
        <span className="text-sm font-bold text-taboo-text">{teamLabel}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {roster.map((p) => (
          <TabooPlayerRow
            key={p.id}
            id={p.id}
            name={p.name}
            avatarUrl={p.avatarUrl}
            avatarEmoji={p.avatarEmoji}
            team={teamKey}
            ready={Boolean(p.ready)}
            connected={p.connected !== false}
            isHost={p.id === hostId}
            isYou={p.id === localUserId}
          />
        ))}
        {roster.length === 0 ? (
          <li className="flex flex-1 items-center justify-center py-8 text-center text-sm text-taboo-text-muted">
            No players
          </li>
        ) : null}
      </ul>
    </div>
  );
}
