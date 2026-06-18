"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RejoinRoomPrompt } from "../../../components/party/RejoinRoomPrompt.jsx";
import { useUser } from "../../../lib/context/UserContext.jsx";
import { clearLastRoomCode, readLastRoomCode } from "../../../lib/session/RoomSession.js";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { cn } from "../../../lib/taboo/cn.js";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { normalizeCode, tabooPath } from "./taboo-shared.js";
import { TabooErrorBanner } from "./components/TabooErrorBanner.jsx";
import { TabooHero } from "./components/TabooHero.jsx";
import { TabooTopBar } from "./components/TabooTopBar.jsx";
import { TabooPage, TabooPageSection } from "./components/TabooPage.jsx";
import {
  TabooButton,
  TabooCard,
  TabooInput,
  TabooNumberStepper,
  TabooSelect,
  TabooSegmentedControl,
} from "./ui/index.js";

/**
 * @param {{ onRoomCreated?: (code: string) => void }} props
 */
export function TabooEntry({ onRoomCreated }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const inviteCodeParam = searchParams.get("code") ?? "";
  const normalizedInvite = inviteCodeParam ? normalizePartyCode(inviteCodeParam).slice(0, 4) : "";

  const { connected, socketError, localUsername, categories, createRoom, joinRoom, leaveRoom, room, getCategories } =
    useTaboo();
  const { user } = useUser();
  const lastRoomCode = readLastRoomCode("taboo", user?.id);
  const showRejoin = connected && lastRoomCode && !room?.code;

  const [createSettings, setCreateSettings] = useState({ roundCount: 5, roundDurationSeconds: 60 });
  const [joinCode, setJoinCode] = useState(normalizedInvite);
  const [categoryMode, setCategoryMode] = useState("single");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [entryTab, setEntryTab] = useState(normalizedInvite ? "join" : "create");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const joinInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const roundOptionLabels = useMemo(
    () => [30, 45, 60, 90, 120, 180].map((seconds) => ({ seconds, label: seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec` })),
    [],
  );

  const resolvedCategoryId =
    selectedCategoryId || (categories.length > 0 ? String(categories[0].categoryId) : "");

  useEffect(() => {
    if (!normalizedInvite || !joinInputRef.current) return;
    joinInputRef.current.focus();
    joinInputRef.current.select();
  }, [normalizedInvite]);

  useEffect(() => {
    if (connected) void getCategories();
  }, [connected, getCategories]);

  async function handleCreate() {
    setSubmitting(true);
    const result = await createRoom({
      ...createSettings,
      categoryMode,
      categoryIds: categoryMode === "single" && resolvedCategoryId ? [Number(resolvedCategoryId)] : undefined,
    });
    setSubmitting(false);
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
    setSubmitting(true);
    const result = await joinRoom(joinCode);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError("");
    const code = result.data?.room?.code ?? joinCode;
    onRoomCreated?.(code);
    router.push(tabooPath("/games/taboo/lobby", code));
  }

  const anim = !reduceMotion;

  return (
    <TabooPage className="max-w-md pb-10">
      <TabooPageSection>
        <TabooTopBar className="justify-end" />
      </TabooPageSection>

      <TabooPageSection>
        <TabooHero />
      </TabooPageSection>

      <TabooPageSection>
        <TabooErrorBanner message={socketError || error} />
      </TabooPageSection>

      {showRejoin ? (
        <TabooPageSection>
          <RejoinRoomPrompt
            roomCode={lastRoomCode}
            lobbyHref={tabooPath("/games/taboo/lobby", lastRoomCode)}
            onRejoin={async () => {
              const result = await joinRoom(lastRoomCode);
              if (!result.ok) {
                setError(result.error.message);
                return result;
              }
              setError("");
              router.push(tabooPath("/games/taboo/lobby", lastRoomCode));
              return result;
            }}
            onLeave={async () => {
              await leaveRoom();
              clearLastRoomCode("taboo", user?.id);
            }}
          />
        </TabooPageSection>
      ) : null}

      <TabooPageSection>
        <TabooCard level={1} className="overflow-hidden border-taboo-border bg-taboo-canvas-mid/80 p-0 backdrop-blur-md">
          <div className="flex border-b border-taboo-border bg-black/20">
            <button
              type="button"
              onClick={() => setEntryTab("create")}
              className={cn(
                "relative flex-1 py-4 text-sm font-medium transition-colors",
                entryTab === "create" ? "text-taboo-text" : "text-taboo-text-faint hover:text-taboo-text-muted",
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Zap className={cn("h-4 w-4", entryTab === "create" ? "text-taboo-team-a-text" : "")} />
                Create Game
              </span>
              {entryTab === "create" ? (
                <motion.div
                  layoutId="tabooEntryTab"
                  className="taboo-tab-underline-create absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setEntryTab("join")}
              className={cn(
                "relative flex-1 py-4 text-sm font-medium transition-colors",
                entryTab === "join" ? "text-taboo-text" : "text-taboo-text-faint hover:text-taboo-text-muted",
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Users className={cn("h-4 w-4", entryTab === "join" ? "text-taboo-team-b-text" : "")} />
                Join Game
              </span>
              {entryTab === "join" ? (
                <motion.div
                  layoutId="tabooEntryTab"
                  className="taboo-tab-underline-join absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                />
              ) : null}
            </button>
          </div>

          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              {entryTab === "create" ? (
                <motion.div
                  key="create"
                  initial={anim ? { opacity: 0, x: -8 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={anim ? { opacity: 0, x: 8 } : undefined}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <TabooInput label="Your name" value={localUsername || ""} readOnly placeholder="Enter your name" />

                  <div className="grid grid-cols-2 gap-3">
                    <TabooNumberStepper
                      label="Rounds"
                      value={createSettings.roundCount}
                      min={1}
                      max={10}
                      onChange={(roundCount) => setCreateSettings((prev) => ({ ...prev, roundCount }))}
                    />
                    <TabooSelect
                      label="Duration"
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
                    </TabooSelect>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-taboo-text-muted">Category</span>
                    <TabooSegmentedControl
                      value={categoryMode}
                      onChange={setCategoryMode}
                      options={[
                        { value: "single", label: "Single" },
                        { value: "all", label: "All" },
                      ]}
                    />
                    {categoryMode === "single" ? (
                      <TabooSelect
                        value={resolvedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        disabled={categories.length === 0}
                      >
                        {categories.length === 0 ? <option value="">Loading…</option> : null}
                        {categories.map((cat) => (
                          <option key={cat.categoryId} value={cat.categoryId}>
                            {cat.category} ({cat.wordCount} words)
                          </option>
                        ))}
                      </TabooSelect>
                    ) : null}
                  </div>

                  <TabooButton
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    disabled={!connected || (categoryMode === "single" && !resolvedCategoryId)}
                    onClick={() => void handleCreate()}
                    className="mt-1 shadow-lg shadow-taboo-team-a/25"
                  >
                    Create Lobby
                    <ArrowRight className="h-4 w-4" />
                  </TabooButton>
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={anim ? { opacity: 0, x: 8 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={anim ? { opacity: 0, x: -8 } : undefined}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <TabooInput label="Your name" value={localUsername || ""} readOnly placeholder="Enter your name" />
                  <div>
                    <TabooInput
                      ref={joinInputRef}
                      label="Lobby code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                      placeholder="XXXX"
                      maxLength={4}
                      inputClassName="h-14 text-center font-mono text-2xl tracking-[0.35em] uppercase"
                    />
                    {normalizedInvite ? (
                      <p className="mt-1 text-sm font-medium text-taboo-team-b-text">Invite link detected — code filled in.</p>
                    ) : null}
                  </div>
                  <TabooButton
                    variant="secondary"
                    size="lg"
                    loading={submitting}
                    disabled={!connected || joinCode.length !== 4}
                    onClick={() => void handleJoin()}
                    className="mt-1 shadow-lg shadow-taboo-team-b/25"
                  >
                    Join Lobby
                    <ArrowRight className="h-4 w-4" />
                  </TabooButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabooCard>
      </TabooPageSection>
    </TabooPage>
  );
}
