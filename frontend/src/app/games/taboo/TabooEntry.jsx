"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../../components/Button.jsx";
import { PageHeader } from "../../../components/PageHeader.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { normalizeCode, tabooPath } from "./taboo-shared.js";

/**
 * @param {{ onRoomCreated?: (code: string) => void }} props
 */
export function TabooEntry({ onRoomCreated }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const inviteCodeParam = searchParams.get("code") ?? "";
  const normalizedInvite = inviteCodeParam ? normalizePartyCode(inviteCodeParam).slice(0, 4) : "";

  const { connected, socketError, localUsername, categories, createRoom, joinRoom, getCategories } = useTaboo();

  const [createSettings, setCreateSettings] = useState({ roundCount: 5, roundDurationSeconds: 60 });
  const [joinCode, setJoinCode] = useState(normalizedInvite);
  const [categoryMode, setCategoryMode] = useState("single");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [entryTab, setEntryTab] = useState(normalizedInvite ? "join" : "create");
  const [error, setError] = useState("");
  const joinInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const roundOptionLabels = useMemo(
    () => [30, 45, 60, 90, 120, 180].map((seconds) => ({ seconds, label: seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec` })),
    [],
  );

  useEffect(() => {
    if (!normalizedInvite) return;
    setJoinCode(normalizedInvite);
    setEntryTab("join");
  }, [normalizedInvite]);

  useEffect(() => {
    if (!normalizedInvite || !joinInputRef.current) return;
    joinInputRef.current.focus();
    joinInputRef.current.select();
  }, [normalizedInvite]);

  useEffect(() => {
    if (connected) void getCategories();
  }, [connected, getCategories]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(String(categories[0].categoryId));
    }
  }, [categories, selectedCategoryId]);

  async function handleCreate() {
    const result = await createRoom({
      ...createSettings,
      categoryMode,
      categoryIds: categoryMode === "single" && selectedCategoryId ? [Number(selectedCategoryId)] : undefined,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError("");
    const code = result.data?.room?.code;
    onRoomCreated?.(code);
    router.push(tabooPath("/games/taboo/lobby", code));
  }

  async function handleJoin() {
    const result = await joinRoom(joinCode);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError("");
    const code = result.data?.room?.code ?? joinCode;
    onRoomCreated?.(code);
    router.push(tabooPath("/games/taboo/lobby", code));
  }

  const inputClass =
    "w-full rounded-xl border border-foreground/15 bg-muted-bright/20 px-3 py-2.5 font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/leaderboard"
            className="rounded-full border border-foreground/10 bg-muted-bright/30 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:bg-muted-bright/50"
          >
            Stats
          </Link>
          <Link
            href="/games"
            className="rounded-full border border-foreground/10 bg-muted-bright/30 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:bg-muted-bright/50"
          >
            All games
          </Link>
        </div>

        <PageHeader gameId="taboo" align="left" className="!max-w-none" />

        {(socketError || error) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {socketError || error}
          </p>
        )}

        <Card variant="elevated" className="overflow-hidden p-0">
          <div className="flex border-b border-foreground/10">
            <button
              type="button"
              onClick={() => setEntryTab("create")}
              className={cn(
                "relative flex-1 py-3.5 text-sm font-bold transition-colors",
                entryTab === "create" ? "text-foreground" : "text-foreground/45 hover:text-foreground/70",
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" />
                Create
              </span>
              {entryTab === "create" ? (
                <motion.div layoutId="tabooEntryTab" className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-accent-sky" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setEntryTab("join")}
              className={cn(
                "relative flex-1 py-3.5 text-sm font-bold transition-colors",
                entryTab === "join" ? "text-foreground" : "text-foreground/45 hover:text-foreground/70",
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                Join
              </span>
              {entryTab === "join" ? (
                <motion.div layoutId="tabooEntryTab" className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          </div>

          {entryTab === "create" ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 p-4 sm:p-5"
            >
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Your name</span>
                <input className={cn(inputClass, "mt-1.5 h-12")} value={localUsername || ""} readOnly />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Rounds</span>
                  <input
                    className={cn(inputClass, "mt-1.5 h-12")}
                    type="number"
                    min={1}
                    max={10}
                    value={createSettings.roundCount}
                    onChange={(e) => setCreateSettings((prev) => ({ ...prev, roundCount: Number(e.target.value) }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Duration</span>
                  <select
                    className={cn(inputClass, "mt-1.5 h-12")}
                    value={createSettings.roundDurationSeconds}
                    onChange={(e) =>
                      setCreateSettings((prev) => ({ ...prev, roundDurationSeconds: Number(e.target.value) }))
                    }
                  >
                    {roundOptionLabels.map((opt) => (
                      <option key={opt.seconds} value={opt.seconds}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <motion.div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Category</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCategoryMode("single")}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-sm font-bold",
                      categoryMode === "single" ? "bg-accent-sky text-white" : "bg-muted-bright/40 text-foreground/60",
                    )}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryMode("all")}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-sm font-bold",
                      categoryMode === "all" ? "bg-accent-sky text-white" : "bg-muted-bright/40 text-foreground/60",
                    )}
                  >
                    All
                  </button>
                </div>
                {categoryMode === "single" ? (
                  <select
                    className={inputClass}
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    disabled={categories.length === 0}
                  >
                    {categories.length === 0 ? <option value="">Loading…</option> : null}
                    {categories.map((cat) => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.category} ({cat.wordCount} words)
                      </option>
                    ))}
                  </select>
                ) : null}
              </motion.div>
              <Button
                variant="primary"
                className="w-full rounded-full py-3"
                disabled={!connected || (categoryMode === "single" && !selectedCategoryId)}
                onClick={() => void handleCreate()}
              >
                Create lobby
                <ArrowRight className="ml-1 inline h-4 w-4" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 p-4 sm:p-5"
            >
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Your name</span>
                <input className={cn(inputClass, "mt-1.5 h-12")} value={localUsername || ""} readOnly />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-foreground/55">Lobby code</span>
                {normalizedInvite ? (
                  <p className="mt-1 text-sm font-semibold text-primary">Invite link detected — code filled in below.</p>
                ) : null}
                <input
                  ref={joinInputRef}
                  className={cn(inputClass, "mt-1.5 h-14 text-center font-mono text-2xl tracking-[0.35em] uppercase")}
                  value={joinCode}
                  onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                  placeholder="XXXX"
                  maxLength={4}
                />
              </label>
              <Button
                variant="primary"
                className="w-full rounded-full py-3"
                disabled={!connected || joinCode.length !== 4}
                onClick={() => void handleJoin()}
              >
                Join lobby
                <ArrowRight className="ml-1 inline h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </Card>
      </main>
    </div>
  );
}
