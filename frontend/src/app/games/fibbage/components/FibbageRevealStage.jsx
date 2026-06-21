"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { FibbagePromptCard } from "./FibbagePromptCard.jsx";
import { Avatar } from "../../../../components/Avatar.jsx";

function findUsername(players, userId) {
  return players?.find((p) => p.userId === userId)?.username ?? "Unknown";
}

function findPlayer(players, userId) {
  return players?.find((p) => p.userId === userId) ?? null;
}

export function FibbageRevealStage() {
  const { room, localUserId } = useFibbage();
  const game = room?.game;

  if (!game || game.status !== "revealing") return null;

  const reveal = game.reveal;
  const answers = game.answers ?? [];
  const roundScores = game.roundScores ?? {};
  const players = room.players ?? [];
  const lies = answers.filter((a) => !a.isTruth);
  const truth = answers.find((a) => a.isTruth);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <FibbagePromptCard
        text={game.prompt?.text}
        category={game.prompt?.category}
        round={game.round}
        totalRounds={room.settings?.roundCount}
      />

      <AnimatePresence mode="wait">
        {reveal?.step === "votes_summary" && (
          <VotesSummary key="votes_summary" answers={answers} />
        )}

        {reveal?.step === "per_lie" && (
          <LieReveal
            key={`lie-${reveal.lieIndex}`}
            lie={lies[reveal.lieIndex]}
            players={players}
            roundScores={roundScores}
            localUserId={localUserId}
          />
        )}

        {(reveal?.step === "truth" || reveal?.step === "complete") && truth && (
          <TruthReveal
            key="truth"
            truth={truth}
            players={players}
            roundScores={roundScores}
            localUserId={localUserId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VotesSummary({ answers }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      <p className="text-center text-sm font-bold text-[var(--fibbage-accent-glow)]">
        Let&rsquo;s see who got fooled...
      </p>
      <div className="space-y-2">
        {answers.map((a) => (
          <div key={a.answerId} className="fibbage-card flex items-center justify-between">
            <p className="text-sm font-semibold">{a.text}</p>
            <span className="text-xs text-[var(--fibbage-text-muted)]">
              {a.voters?.length ?? "?"} votes
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function LieReveal({ lie, players, roundScores, localUserId }) {
  if (!lie) return null;

  const author = findPlayer(players, lie.authorUserId);
  const authorName = author?.username ?? "Unknown";
  const voters = lie.voters ?? [];
  const foolPoints = roundScores[lie.authorUserId]?.fooled ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-4"
    >
      <div className="fibbage-card space-y-3">
        <p className="text-lg font-bold text-[var(--fibbage-lie)]">&ldquo;{lie.text}&rdquo;</p>
        <div className="flex items-center gap-2">
          {author && (
            <Avatar
              avatarUrl={author.avatarUrl}
              avatarEmoji={author.avatarEmoji}
              username={authorName}
              size={24}
            />
          )}
          <span className="text-sm font-semibold">Written by {authorName}</span>
        </div>

        {voters.length > 0 && (
          <div className="space-y-2 border-t border-[var(--fibbage-card-border)] pt-3">
            <p className="text-xs font-bold text-[var(--fibbage-text-muted)]">
              Fooled {voters.length} player{voters.length !== 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap gap-2">
              {voters.map((vId) => {
                const p = findPlayer(players, vId);
                return (
                  <span
                    key={vId}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--fibbage-canvas-light)] px-2 py-1 text-xs font-semibold"
                  >
                    {p && (
                      <Avatar
                        avatarUrl={p.avatarUrl}
                        avatarEmoji={p.avatarEmoji}
                        username={p.username}
                        size={16}
                      />
                    )}
                    {p?.username ?? "Unknown"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {foolPoints.length > 0 && (
          <motion.p
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="fibbage-score-pop text-right"
          >
            +{foolPoints.reduce((s, f) => s + f.points, 0)}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

function TruthReveal({ truth, players, roundScores, localUserId }) {
  const voters = truth.voters ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="space-y-4"
    >
      <motion.div
        className="fibbage-card fibbage-card--truth space-y-3"
        animate={{ boxShadow: ["0 0 0px rgba(16,185,129,0)", "0 0 30px rgba(16,185,129,0.4)", "0 0 0px rgba(16,185,129,0)"] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--fibbage-truth)]">
          The Truth
        </p>
        <p className="text-center text-xl font-bold text-[var(--fibbage-truth)]">
          &ldquo;{truth.text}&rdquo;
        </p>

        {voters.length > 0 && (
          <div className="space-y-2 border-t border-[var(--fibbage-truth)] border-opacity-30 pt-3">
            <p className="text-xs font-bold text-[var(--fibbage-text-muted)]">
              Found by {voters.length} player{voters.length !== 1 ? "s" : ""}:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {voters.map((vId) => {
                const p = findPlayer(players, vId);
                const pScores = roundScores[vId];
                const pts = pScores?.truthPick?.points ?? 0;
                return (
                  <motion.span
                    key={vId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--fibbage-truth)] bg-opacity-10 px-3 py-1.5 text-xs font-bold"
                  >
                    {p && (
                      <Avatar
                        avatarUrl={p.avatarUrl}
                        avatarEmoji={p.avatarEmoji}
                        username={p.username}
                        size={16}
                      />
                    )}
                    {p?.username ?? "Unknown"}
                    {pts > 0 && (
                      <span className="text-[var(--fibbage-gold)]">+{pts}</span>
                    )}
                    {pScores?.truthPick?.solo && (
                      <span className="text-[var(--fibbage-gold-glow)]">SOLO!</span>
                    )}
                  </motion.span>
                );
              })}
            </div>
          </div>
        )}

        {voters.length === 0 && (
          <p className="text-center text-sm font-semibold text-[var(--fibbage-text-muted)]">
            Nobody found the truth!
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
