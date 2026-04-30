"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  LogOut,
  MessageCircle,
  Mic,
  Play,
  Sparkles,
  SkipForward,
  Target,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { motionPresets } from "../../../lib/taboo/motion.js";
import { teamColors } from "../../../lib/taboo/variants.js";
import { useGameFeedback } from "../../../lib/taboo/useGameFeedback.js";
import { ConfirmDialog } from "../../../components/taboo/ConfirmDialog.jsx";
import { StatusPill } from "../../../components/taboo/StatusPill.jsx";
import { GameFeedbackOverlay } from "../../../components/taboo/GameFeedbackOverlay.jsx";

function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function buildPlayerRecapRows(players, history) {
  const rows = new Map();
  for (const p of players || []) {
    rows.set(p.id, { id: p.id, name: p.name, team: p.team, correct: 0, close: 0, wrong: 0, skips: 0, taboos: 0 });
  }
  for (const entry of history || []) {
    if (!entry.playerId || !rows.has(entry.playerId)) continue;
    const row = rows.get(entry.playerId);
    if (entry.action === "submit_guess" && entry.matched) row.correct += 1;
    else if (entry.action === "submit_guess") row.wrong += 1;
    else if (entry.action === "close_guess") row.close += 1;
    else if (entry.action === "skip_card") row.skips += 1;
    else if (entry.action === "taboo_called") row.taboos += 1;
  }
  return [...rows.values()].sort((a, b) => b.correct - a.correct);
}

function GameOverScreen({ game, players, onLeave }) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  const winner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "tie";
  const recapRows = buildPlayerRecapRows(players, game?.history);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-6 text-center" {...motionPresets.modal}>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
          <Trophy className="h-7 w-7 text-white" />
        </div>
        <h2 className="mb-1 text-2xl font-bold text-white">Game Over!</h2>
        <p className="mb-5 text-sm text-neutral-400">{winner === "tie" ? "It's a tie!" : `Team ${winner === "A" ? "Alpha" : "Beta"} wins!`}</p>
        <div className="mb-6 flex items-center justify-center gap-6">
          <div className="text-center"><p className="mb-1 text-xs text-neutral-500">Alpha</p><p className={cn("text-3xl font-bold", winner === "A" ? "text-emerald-400" : "text-white")}>{scoreA}</p></div>
          <div className="text-lg text-neutral-600">vs</div>
          <div className="text-center"><p className="mb-1 text-xs text-neutral-500">Beta</p><p className={cn("text-3xl font-bold", winner === "B" ? "text-emerald-400" : "text-white")}>{scoreB}</p></div>
        </div>
        {recapRows.length > 0 ? (
          <div className="mb-6 max-h-40 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Per player</p>
            <ul className="space-y-1.5 text-xs text-neutral-300">
              {recapRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-1 border-b border-white/[0.04] pb-1.5 last:border-0">
                  <span className="font-medium text-white">{row.name}</span>
                  <span className="text-neutral-400">+{row.correct} correct{row.close ? ` · ${row.close} close` : ""}{row.skips ? ` · ${row.skips} skip` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button type="button" onClick={onLeave} className="h-11 w-full rounded-xl bg-white/[0.06] text-sm font-medium text-white transition-all hover:bg-white/[0.1]">Leave Game</button>
      </motion.div>
    </div>
  );
}

const ROLE_BADGES = {
  clue_giver: { icon: Mic, label: "You're the Clue Giver", className: "border-blue-500/30 bg-blue-500/15 text-blue-300" },
  teammate_guesser: { icon: MessageCircle, label: "You're Guessing", className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  opponent_observer: { icon: Eye, label: "Monitoring for Taboo", className: "border-red-500/30 bg-red-500/15 text-red-300" },
  spectator: { icon: Eye, label: "Watching", className: "border-white/10 bg-white/5 text-neutral-400" },
};

function PhasePanel({ game, canStartTurn, onStartTurn, countdown, startTurnDisabled }) {
  const activeName = game?.activeTurn?.playerName || "Player";
  const activeTeamLabel = game?.activeTeam === "B" ? "Beta" : "Alpha";
  const summary = game?.lastTurnSummary;

  if (game?.status === "waiting_to_start_turn") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="mb-1 text-sm text-neutral-400">Next turn</p>
        <h2 className="mb-2 text-xl font-bold text-white">{activeName}</h2>
        <p className="mb-4 text-sm text-neutral-500">Team {activeTeamLabel}</p>
        {canStartTurn ? (
          <button type="button" onClick={onStartTurn} className="mx-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 text-sm font-semibold text-white">
            <Play className="h-4 w-4" />
            Start Turn
          </button>
        ) : startTurnDisabled ? (
          <p className="text-sm text-amber-200/90">Reconnecting... Start Turn will be available when live.</p>
        ) : (
          <p className="text-sm text-neutral-400">Waiting for {activeName} to start their turn.</p>
        )}
      </div>
    );
  }

  if (game?.status === "between_turns") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        {summary ? (
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">
              {summary.clueGiverName} scored <span className="text-emerald-400">{summary.correctGuesses}</span> point{summary.correctGuesses === 1 ? "" : "s"} for Team {summary.team === "B" ? "Beta" : "Alpha"}
            </p>
            {summary.taboos > 0 ? <p className="mt-1 text-xs text-red-400">{summary.taboos} taboo {summary.taboos === 1 ? "penalty" : "penalties"}</p> : null}
          </div>
        ) : null}
        <p className="mb-2 text-sm text-neutral-400">Up next</p>
        <p className="text-base font-semibold text-white">{activeName} from Team {activeTeamLabel}</p>
        <p className="mt-2 text-sm text-neutral-500">Starting in {countdown}s...</p>
      </div>
    );
  }

  if (game?.status === "between_rounds") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="mb-2 text-sm text-neutral-400">Round {game.roundNumber} complete</p>
        <div className="mb-3 flex items-center justify-center gap-4">
          <div className="text-center"><p className="text-xs text-neutral-500">Alpha</p><p className="text-lg font-bold text-white">{game.scores?.A ?? 0}</p></div>
          <span className="text-neutral-600">vs</span>
          <div className="text-center"><p className="text-xs text-neutral-500">Beta</p><p className="text-lg font-bold text-white">{game.scores?.B ?? 0}</p></div>
        </div>
        <p className="text-base font-semibold text-white">Round {game.nextRoundNumber} starts in {countdown}s</p>
      </div>
    );
  }

  return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center"><p className="text-sm text-neutral-400">Synchronizing turn state</p></div>;
}

export default function TabooClient({ view }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    room,
    connected,
    connectionState,
    socketError,
    localUserId,
    localUsername,
    categories,
    createRoom,
    joinRoom,
    leaveRoom,
    getCategories,
    setReady,
    changeTeam,
    setCategories,
    startTurn,
    submitGuess,
    skipCard,
    tabooCalled,
    requestReview,
    dismissReview,
    reviewVote,
    reviewContinue,
  } = useTaboo();

  const [createSettings, setCreateSettings] = useState({ roundCount: 5, roundDurationSeconds: 60 });
  const [joinCode, setJoinCode] = useState("");
  const [categoryMode, setCategoryMode] = useState("single");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [entryTab, setEntryTab] = useState("create");
  const [guess, setGuess] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const lastPromptedReviewIdRef = useRef(null);
  const roundOptionLabels = useMemo(
    () => [30, 45, 60, 90, 120, 180].map((seconds) => ({ seconds, label: seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec` })),
    [],
  );
  const me = useMemo(() => room?.players?.find((p) => p.id === localUserId) ?? null, [room?.players, localUserId]);
  const game = room?.game;
  const feedbackVariant = useGameFeedback({
    history: game?.history,
    review: game?.review,
    gameStatus: game?.status,
    reduceMotion,
  });

  async function handleCreate() {
    const result = await createRoom({
      ...createSettings,
      categoryMode,
      categoryIds: categoryMode === "single" && selectedCategoryId ? [Number(selectedCategoryId)] : undefined,
    });
    if (!result.ok) return setError(result.error.message);
    setError("");
    router.push("/games/taboo/lobby");
  }

  async function handleJoin() {
    const result = await joinRoom(joinCode);
    if (!result.ok) return setError(result.error.message);
    setError("");
    router.push("/games/taboo/lobby");
  }

  async function act(action, payload) {
    const result = await action(payload);
    if (!result.ok) setError(result.error.message);
    else setError("");
  }

  async function copyCode() {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const connectedVariant = connectionState === "connected" ? "success" : connectionState === "reconnecting" ? "warning" : "danger";
  const teamA = teamColors("A");
  const teamB = teamColors("B");
  const role = game?.viewerRole || "spectator";
  const isRealtimeConnected = connectionState === "connected";
  const review = game?.review;

  useEffect(() => {
    const target = game?.turnEndsAt || game?.phaseEndsAt || game?.roundEndsAt;
    if (!target) {
      setSecondsRemaining(game?.secondsRemaining ?? 0);
      return undefined;
    }
    const tick = () => {
      const ms = target - Date.now();
      setSecondsRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [game?.turnEndsAt, game?.phaseEndsAt, game?.roundEndsAt, game?.secondsRemaining]);

  useEffect(() => {
    if (view === "entry" && room?.code) {
      router.replace("/games/taboo/lobby");
    }
  }, [view, room?.code, router]);

  useEffect(() => {
    if (view === "lobby" && room?.game) {
      router.replace("/games/taboo/play");
    }
  }, [view, room?.game, router]);

  useEffect(() => {
    if (view === "entry" && connected) {
      void getCategories();
    }
  }, [view, connected, getCategories]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(String(categories[0].categoryId));
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (review?.status !== "available" || !game?.permissions?.canRequestReview || !review?.id) {
      setShowReviewPrompt(false);
      return;
    }
    if (lastPromptedReviewIdRef.current === review.id) return;
    lastPromptedReviewIdRef.current = review.id;
    setShowReviewPrompt(true);
  }, [review?.status, review?.id, game?.permissions?.canRequestReview]);

  if (view === "entry") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
        <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a] pointer-events-none" />
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#1e3a5f]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#b73b3b]/10 rounded-full blur-[100px] pointer-events-none" />

        <main className="relative z-10 flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8 max-w-md mx-auto w-full">
          <div className="mb-3 flex justify-end gap-2">
            <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-white">Stats</Link>
            <Link href="/games" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-white">How to Play</Link>
          </div>
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2a4d7a] mb-3 shadow-lg shadow-[#1e3a5f]/20">
              <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Taboo</h1>
            <p className="text-sm text-neutral-400 mt-1">The ultimate party word game</p>
          </motion.div>

          {(socketError || error) && (
            <p className="mb-3 rounded-xl bg-[#b73b3b]/10 border border-[#b73b3b]/20 px-3 py-2 text-sm text-[#c94d4d]">{socketError || error}</p>
          )}

          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col">
            <div className="flex border-b border-white/[0.06]">
              <button type="button" onClick={() => setEntryTab("create")} className={cn("flex-1 py-3.5 text-sm font-medium transition-all relative", entryTab === "create" ? "text-white" : "text-neutral-500 hover:text-neutral-300")}><span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" />Create Game</span>{entryTab === "create" ? <motion.div layoutId="activeTab" className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ca8] rounded-full" /> : null}</button>
              <button type="button" onClick={() => setEntryTab("join")} className={cn("flex-1 py-3.5 text-sm font-medium transition-all relative", entryTab === "join" ? "text-white" : "text-neutral-500 hover:text-neutral-300")}><span className="flex items-center justify-center gap-2"><Users className="w-4 h-4" />Join Game</span>{entryTab === "join" ? <motion.div layoutId="activeTab" className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#b73b3b] to-[#c94d4d] rounded-full" /> : null}</button>
            </div>

            {entryTab === "create" ? (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Your Name</label>
                  <input className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 text-neutral-300" value={localUsername || ""} readOnly />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Rounds</label>
                    <input className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3" type="number" min={1} max={10} value={createSettings.roundCount} onChange={(e) => setCreateSettings((prev) => ({ ...prev, roundCount: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Duration</label>
                    <select className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3" value={createSettings.roundDurationSeconds} onChange={(e) => setCreateSettings((prev) => ({ ...prev, roundDurationSeconds: Number(e.target.value) }))}>
                      {roundOptionLabels.map((opt) => (
                        <option key={opt.seconds} value={opt.seconds} className="bg-neutral-900">{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Category</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCategoryMode("single")} className={cn("flex-1 h-10 rounded-lg text-sm font-medium transition-all", categoryMode === "single" ? "bg-[#1e3a5f] text-white" : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]")}>Single</button>
                    <button type="button" onClick={() => setCategoryMode("all")} className={cn("flex-1 h-10 rounded-lg text-sm font-medium transition-all", categoryMode === "all" ? "bg-[#1e3a5f] text-white" : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]")}>All</button>
                  </div>
                  {categoryMode === "single" ? (
                    <select className="w-full h-12 rounded-xl bg-white/[0.04] border border-[#3b6ca8]/60 px-3" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} disabled={categories.length === 0}>
                      {categories.length === 0 ? <option value="" className="bg-neutral-900">Loading categories...</option> : null}
                      {categories.map((cat) => (
                        <option key={cat.categoryId} value={cat.categoryId} className="bg-neutral-900">{cat.category} ({cat.wordCount} words)</option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <button className="w-full h-12 rounded-xl bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white font-semibold text-sm hover:from-[#2a4d7a] hover:to-[#3b6ca8] transition-all disabled:opacity-50 flex items-center justify-center gap-2" onClick={handleCreate} disabled={!connected || (categoryMode === "single" && !selectedCategoryId)}>Create Lobby <ArrowRight className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Your Name</label>
                  <input className="w-full h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 text-neutral-300" value={localUsername || ""} readOnly />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Lobby Code</label>
                  <input className="w-full h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-center text-2xl tracking-[0.35em]" value={joinCode} onChange={(e) => setJoinCode(normalizeCode(e.target.value))} placeholder="XXXX" />
                </div>
                <button className="w-full h-12 rounded-xl bg-gradient-to-r from-[#b73b3b] to-[#c94d4d] text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2" onClick={handleJoin} disabled={!connected || joinCode.length !== 4}>Join Lobby <ArrowRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!room) {
    if (connectionState === "reconnecting" || connectionState === "disconnected") {
      return <div className="mx-auto w-full max-w-lg px-4 py-8 text-white">Reconnecting to your Taboo room...</div>;
    }
    return <div className="mx-auto w-full max-w-lg px-4 py-8 text-white">No active Taboo room. Go to `/games/taboo`.</div>;
  }

  if (view === "lobby") {
    const teamACount = room?.teams?.A?.length ?? 0;
    const teamBCount = room?.teams?.B?.length ?? 0;
    const canAutoStart = room.allReady && teamACount > 0 && teamBCount > 0;
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
        <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a] pointer-events-none" />
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#1e3a5f]/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#b73b3b]/10 rounded-full blur-[100px] pointer-events-none" />
        <motion.header initial={reduceMotion ? false : { opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <button onClick={() => setShowLeaveConfirm(true)} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"><LogOut className="w-5 h-5" /><span className="text-sm hidden sm:inline">Leave</span></button>
          <StatusPill variant={connectedVariant}>{connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}<span className="capitalize">{connectionState}</span></StatusPill>
        </motion.header>
        <main className="relative z-10 flex-1 flex flex-col px-4 py-4 sm:py-6 max-w-lg mx-auto w-full">
          {(error || socketError) && <p className="mb-3 rounded-xl bg-[#b73b3b]/10 border border-[#b73b3b]/20 px-3 py-2 text-sm text-[#c94d4d]">{error || socketError}</p>}
          <motion.section {...(reduceMotion ? {} : motionPresets.sectionEnter(0))} className="text-center mb-6">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Lobby Code</p>
            <div className="flex items-center justify-center gap-3">
              <h1 className="text-5xl font-bold tracking-wider font-mono">{room.code}</h1>
              <button onClick={copyCode} className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-400" />}</button>
            </div>
          </motion.section>
          <motion.section {...(reduceMotion ? {} : motionPresets.sectionEnter(0.05))} className="mb-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <Target className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-400">Rounds</span>
                  <span className="ml-auto text-sm font-semibold text-white">{room.settings?.roundCount}</span>
                </div>
                <div className="w-px h-4 bg-white/[0.08]" />
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-400">Time</span>
                  <span className="ml-auto text-sm font-semibold text-white">{room.settings?.roundDurationSeconds}s</span>
                </div>
              </div>
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-xs text-neutral-500 mb-1">Categories</p>
                <p className="text-sm text-white">{room.settings?.categoryNames?.join(", ") || "All Categories"}</p>
                {room.hostId === localUserId && !room.game ? (
                  <div className="mt-3">
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => act(() => setCategories("all", []))}
                        className={cn("flex-1 h-9 rounded-lg text-xs font-medium transition-all", room.settings?.categoryMode === "all" ? "bg-[#1e3a5f] text-white" : "bg-white/[0.04] text-neutral-300")}
                      >
                        ALL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const fallback = selectedCategoryId || (categories[0] ? String(categories[0].categoryId) : "");
                          if (!fallback) return;
                          act(() => setCategories("single", [Number(fallback)]));
                        }}
                        className={cn("flex-1 h-9 rounded-lg text-xs font-medium transition-all", room.settings?.categoryMode === "single" ? "bg-[#1e3a5f] text-white" : "bg-white/[0.04] text-neutral-300")}
                      >
                        SINGLE
                      </button>
                    </div>
                    {room.settings?.categoryMode === "single" ? (
                      <select
                        className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 text-xs"
                        value={selectedCategoryId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCategoryId(val);
                          if (val) act(() => setCategories("single", [Number(val)]));
                        }}
                      >
                        {categories.map((cat) => (
                          <option key={cat.categoryId} value={cat.categoryId} className="bg-neutral-900">
                            {cat.category}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.section>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button className={cn("relative p-3 rounded-xl border-2 transition-all", me?.team === "A" ? cn(teamA.bg, teamA.border) : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]")} onClick={() => act(changeTeam, "A")}><div className="flex items-center gap-2 mb-1"><div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", teamA.iconBg)}><Users className={cn("w-3.5 h-3.5", teamA.iconText)} /></div><span className="text-sm font-semibold">Alpha</span></div><div className="text-xs text-neutral-500">{teamACount} players</div></button>
            <button className={cn("relative p-3 rounded-xl border-2 transition-all", me?.team === "B" ? cn(teamB.bg, teamB.border) : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]")} onClick={() => act(changeTeam, "B")}><div className="flex items-center gap-2 mb-1"><div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", teamB.iconBg)}><Users className={cn("w-3.5 h-3.5", teamB.iconText)} /></div><span className="text-sm font-semibold">Beta</span></div><div className="text-xs text-neutral-500">{teamBCount} players</div></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
            <div className={cn("p-3 rounded-2xl bg-gradient-to-b to-transparent border", teamA.gradientFrom, teamA.borderFaint)}>
              <div className="flex items-center gap-2 mb-3"><div className={cn("w-2 h-2 rounded-full", teamA.dot)} /><span className="text-xs font-semibold text-white">Team Alpha</span></div>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {(room?.players ?? []).filter((p) => p.team === "A").map((p) => (
                    <motion.div key={p.id} {...(reduceMotion ? {} : motionPresets.playerItem)} className={cn("flex min-h-12 items-center gap-2 rounded-lg p-2.5", p.id === localUserId ? teamA.highlight : "bg-white/[0.03]")}>
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", p.id === localUserId ? cn(teamA.avatarBg, "text-white") : "bg-white/10 text-neutral-400")}>{p.name?.charAt(0) || "?"}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-white">{p.name}{p.id === localUserId ? <span className="text-neutral-500"> (You)</span> : null}</p></div>
                      <StatusPill variant={p.ready ? "success" : "warning"} className="shrink-0 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">{p.ready ? "Ready" : "Not Ready"}</StatusPill>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <div className={cn("p-3 rounded-2xl bg-gradient-to-b to-transparent border", teamB.gradientFrom, teamB.borderFaint)}>
              <div className="flex items-center gap-2 mb-3"><div className={cn("w-2 h-2 rounded-full", teamB.dot)} /><span className="text-xs font-semibold text-white">Team Beta</span></div>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {(room?.players ?? []).filter((p) => p.team === "B").map((p) => (
                    <motion.div key={p.id} {...(reduceMotion ? {} : motionPresets.playerItem)} className={cn("flex min-h-12 items-center gap-2 rounded-lg p-2.5", p.id === localUserId ? teamB.highlight : "bg-white/[0.03]")}>
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", p.id === localUserId ? cn(teamB.avatarBg, "text-white") : "bg-white/10 text-neutral-400")}>{p.name?.charAt(0) || "?"}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-white">{p.name}{p.id === localUserId ? <span className="text-neutral-500"> (You)</span> : null}</p></div>
                      <StatusPill variant={p.ready ? "success" : "warning"} className="shrink-0 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">{p.ready ? "Ready" : "Not Ready"}</StatusPill>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Ready Status</p>
            <p className="text-sm text-neutral-300">
              {(room?.players ?? []).filter((p) => p.ready).length} / {(room?.players ?? []).length} players ready
            </p>
          </div>
          <button className={cn("w-full h-12 rounded-xl font-semibold text-sm transition-all mb-3", me?.ready ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "bg-white/[0.04] border border-white/[0.08]")} onClick={() => act(setReady, !me?.ready)}>{me?.ready ? "Ready! Tap to unready" : "Mark as Ready"}</button>
          <div className={cn("w-full h-12 rounded-xl font-semibold text-sm transition-all flex items-center justify-center", canAutoStart ? "bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white" : "bg-white/[0.02] text-neutral-500")}>
            {canAutoStart ? "Starting game..." : `Waiting for ${room?.players?.filter((p) => !p.ready).length || 0} player(s)...`}
          </div>
        </main>
        <ConfirmDialog open={showLeaveConfirm} title="Leave Lobby?" description="You'll be removed from this lobby and need the code to rejoin." confirmLabel="Leave" cancelLabel="Stay" variant="danger" onConfirm={async () => { await leaveRoom(); router.push("/games/taboo"); }} onCancel={() => setShowLeaveConfirm(false)} />
      </div>
    );
  }

  const isFinished = game?.status === "finished";
  if (view === "result" || isFinished) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white">
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
        <div className="relative z-10">
          <GameOverScreen game={game} players={room?.players} onLeave={async () => { await leaveRoom(); router.push("/games/taboo"); }} />
        </div>
      </div>
    );
  }

  const normalizedStatus = game?.status === "in_progress" ? "turn_in_progress" : game?.status;
  const roundDuration = room?.settings?.roundDurationSeconds ?? 60;
  const timerPercent = normalizedStatus === "turn_in_progress" && roundDuration > 0 ? (secondsRemaining / roundDuration) * 100 : 0;
  const timerColor = secondsRemaining <= 10 ? "text-red-400" : secondsRemaining <= 20 ? "text-amber-400" : "text-white";
  const roleBadge = ROLE_BADGES[role] || ROLE_BADGES.spectator;
  const RoleIcon = roleBadge.icon;
  const showReviewPanel = review && (review.status === "in_progress" || review.status === "resolved");
  const reviewPaused = review?.status === "in_progress" || review?.status === "resolved";

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <GameFeedbackOverlay variant={feedbackVariant} reduceMotion={reduceMotion} />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-col px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setShowLeaveConfirm(true)} className="flex items-center gap-2 text-neutral-400 hover:text-white"><LogOut className="h-5 w-5" />Leave</button>
          <p className="text-sm">Round {game?.roundNumber || 0}/{game?.totalRounds || 0}</p>
        </div>
        <AnimatePresence>
          {(connectionState === "reconnecting" || connectionState === "disconnected") ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-sm text-amber-100">
              Reconnecting... actions are temporarily disabled.
            </motion.p>
          ) : null}
        </AnimatePresence>
        {error ? <p className="mb-3 rounded bg-red-900/30 px-3 py-2 text-sm">{error}</p> : null}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={cn("rounded-xl border p-3", game.activeTeam === "A" ? teamA.activeScoreBg : teamA.inactiveScoreBg)}><p className="text-xs text-neutral-400">Alpha</p><p className="text-2xl font-bold">{game.scores?.A ?? 0}</p></div>
          <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center"><Clock className="mx-auto mb-1 h-4 w-4 text-neutral-500" /><p className={cn("text-2xl font-mono font-bold", timerColor)}>{secondsRemaining}</p>{normalizedStatus === "turn_in_progress" ? <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ca8] transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, timerPercent))}%` }} /> : null}</div>
          <div className={cn("rounded-xl border p-3", game.activeTeam === "B" ? teamB.activeScoreBg : teamB.inactiveScoreBg)}><p className="text-right text-xs text-neutral-400">Beta</p><p className="text-right text-2xl font-bold">{game.scores?.B ?? 0}</p></div>
        </div>
        <div className="mb-3 flex justify-center"><div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", roleBadge.className)}><RoleIcon className="h-3.5 w-3.5" />{roleBadge.label}</div></div>
        {showReviewPanel ? (
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 mb-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">Taboo Review</p>
                <p className="text-sm font-semibold">{
                  review.status === "in_progress" ? "Review in progress" : "Review resolved"
                }</p>
                <p className="text-xs text-neutral-500">
                  Called by {review?.tabooCalledBy?.playerName || "Opponent"} · Team {review?.penalizedTeam === "B" ? "Beta" : "Alpha"} penalized
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
                {review?.notFairCount ?? 0} not fair · {review?.fairCount ?? 0} fair
              </span>
            </div>
            {review.tabooCard ? <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 mb-3"><h3 className="text-center text-2xl font-bold">{review.tabooCard.question}</h3><div className="mt-3 flex flex-wrap justify-center gap-1.5">{(review.tabooCard.taboo || []).map((word) => <span key={word} className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">{word}</span>)}</div></div> : null}
            <div className="flex gap-2 flex-wrap">
              {game?.permissions?.canVoteReview ? <><button className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm" onClick={() => act(reviewVote, "fair")} disabled={!isRealtimeConnected}>Vote Fair</button><button className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm" onClick={() => act(reviewVote, "not_fair")} disabled={!isRealtimeConnected}>Vote Not Fair</button></> : null}
              {game?.permissions?.canContinueAfterReview ? <button className="w-full rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 py-2 text-sm" onClick={() => act(reviewContinue)} disabled={!isRealtimeConnected}>Continue Turn</button> : null}
            </div>
            {review?.status === "resolved" ? (
              <p className="mt-3 text-xs text-neutral-500">
                {review?.fairCount ?? 0} fair · {review?.notFairCount ?? 0} not fair · {review?.eligibleCount ?? 0} total
              </p>
            ) : null}
            {Array.isArray(review?.votes) && review.votes.length > 0 ? (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-neutral-400">Votes</p>
                <div className="space-y-1 text-xs text-neutral-300">
                  {review.votes.map((voteEntry) => (
                    <div key={voteEntry.playerId} className="flex items-center justify-between">
                      <span>{voteEntry.playerName || "Player"}</span>
                      <span className="font-medium capitalize text-neutral-200">{voteEntry.vote ? voteEntry.vote.replace("_", " ") : "pending"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {normalizedStatus !== "turn_in_progress" ? (
          <div className="mb-4">
            <PhasePanel
              game={{ ...game, status: normalizedStatus }}
              canStartTurn={Boolean(game?.permissions?.canStartTurn) && isRealtimeConnected}
              onStartTurn={() => act(startTurn)}
              countdown={secondsRemaining}
              startTurnDisabled={!isRealtimeConnected && Boolean(game?.permissions?.canStartTurn)}
            />
          </div>
        ) : null}
        {normalizedStatus === "turn_in_progress" && !reviewPaused ? (
          <>
            <motion.div key={game?.currentCard?.id || "hidden"} {...(reduceMotion ? {} : motionPresets.cardSwap)} className="mb-4 flex min-h-[280px] flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5">
              {game?.cardVisibleToViewer && game?.currentCard ? (
                <>
                  <div className="mb-4 flex justify-center"><span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-neutral-400">{game.currentCard.category || "-"}</span></div>
                  <div className="flex flex-1 items-center justify-center"><h2 className="text-center text-3xl font-bold leading-tight">{game.currentCard.question || "Waiting"}</h2></div>
                  <div className="mt-4 border-t border-white/[0.06] pt-4"><p className="mb-3 text-center text-[10px] uppercase tracking-wider text-red-400/80">Forbidden Words</p><div className="flex flex-wrap items-center justify-center gap-1.5">{(game.currentCard.taboo || []).map((word, index) => <motion.span key={word} {...(reduceMotion ? {} : motionPresets.tabooWord(index))} className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300">{word}</motion.span>)}</div></div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center"><p className="mb-2 text-lg font-semibold">Hidden Card</p><p className="text-sm text-neutral-400">Guess the word from your clue giver.</p></div>
              )}
            </motion.div>
            <div className="flex flex-wrap gap-2 mb-3">
              {game?.permissions?.canSubmitGuess ? (
                <div className="flex w-full gap-2">
                  <input className="h-11 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={isRealtimeConnected ? "Type your guess..." : "Reconnecting…"} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); act(submitGuess, guess); setGuess(""); } }} />
                  <button className="h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-300 disabled:opacity-50" disabled={!isRealtimeConnected} onClick={() => { act(submitGuess, guess); setGuess(""); }}>Guess</button>
                </div>
              ) : null}
              {game?.permissions?.canSkipCard ? <button className="w-full rounded-xl border-2 border-amber-500/30 bg-amber-500/20 p-4 font-semibold text-amber-400 disabled:opacity-50" disabled={!isRealtimeConnected} onClick={() => act(skipCard)}><SkipForward className="mx-auto mb-1 h-6 w-6" /><span className="block text-xs">Skip Card</span></button> : null}
              {game?.permissions?.canCallTaboo ? <button className="w-full rounded-xl border-2 border-red-500/30 bg-red-500/20 p-4 font-semibold text-red-400 disabled:opacity-50" disabled={!isRealtimeConnected} onClick={() => act(tabooCalled)}><AlertTriangle className="mx-auto mb-1 h-6 w-6" /><span className="block text-xs">Call Taboo!</span></button> : null}
            </div>
          </>
        ) : null}
        {review?.status === "available" && game?.permissions?.canRequestReview ? <button className="rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 py-2 text-sm mb-3" onClick={() => act(requestReview)} disabled={!isRealtimeConnected}>Request Review</button> : null}
        {Array.isArray(game?.history) && game.history.length > 0 ? (
          <div className="mt-3 max-h-[220px] overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-neutral-400">Game Log</p>
            {game.history.slice(-80).map((entry, i) => {
              const key = `${entry.at}-${entry.action}-${i}`;
              if (entry.action === "submit_guess" && entry.matched) return <div key={key} className="flex items-center gap-2 py-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /><span>{entry.playerName} guessed correctly!</span></div>;
              if (entry.action === "submit_guess") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-neutral-400"><XCircle className="h-3.5 w-3.5" /><span>{entry.playerName}: "{entry.guess}"</span></div>;
              if (entry.action === "close_guess") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-amber-400"><MessageCircle className="h-3.5 w-3.5" /><span>{entry.playerName}: close guess "{entry.guess}"</span></div>;
              if (entry.action === "skip_card") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-yellow-300"><SkipForward className="h-3.5 w-3.5" /><span>{entry.playerName} skipped the card</span></div>;
              if (entry.action === "taboo_called") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" /><span>Taboo! -1 for Team {entry.penalizedTeam === "B" ? "Beta" : "Alpha"}</span></div>;
              if (entry.action === "review_vote") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-sky-300"><Users className="h-3.5 w-3.5" /><span>{entry.playerName} voted {entry.vote?.replace("_", " ")}</span></div>;
              if (entry.action === "review_resolved") return <div key={key} className="flex items-center gap-2 py-1 text-xs text-sky-300"><CheckCircle2 className="h-3.5 w-3.5" /><span>Review resolved: {entry.outcome}</span></div>;
              if (entry.action === "turn_started" || entry.action === "turn_ended" || entry.action === "round_started" || entry.action === "round_completed" || entry.action === "game_finished") {
                return <div key={key} className="flex items-center gap-2 py-1 text-xs text-neutral-400"><Clock className="h-3.5 w-3.5" /><span>{entry.action.replaceAll("_", " ")}</span></div>;
              }
              return null;
            })}
          </div>
        ) : null}
      </div>
      <ConfirmDialog open={showLeaveConfirm} title="Leave Game?" description="You'll be removed from the game in progress. This can't be undone." confirmLabel="Leave" cancelLabel="Stay" variant="danger" onConfirm={async () => { await leaveRoom(); router.push("/games/taboo"); }} onCancel={() => setShowLeaveConfirm(false)} />
      <ConfirmDialog open={showReviewPrompt} title="Taboo Called" description="The opposing team called Taboo. Do you want to request a review, or ignore it and continue?" confirmLabel="Request review" cancelLabel="Ignore" variant="primary" onConfirm={() => { setShowReviewPrompt(false); act(requestReview); }} onCancel={() => { setShowReviewPrompt(false); act(dismissReview); }} />
    </div>
  );
}
