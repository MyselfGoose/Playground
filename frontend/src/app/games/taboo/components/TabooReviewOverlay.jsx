"use client";

import { motion } from "framer-motion";
import { cn } from "../../../../lib/taboo/cn.js";
import { motionPresets } from "../../../../lib/taboo/motion.js";
import { TabooButton, TabooChip } from "../ui/index.js";

/**
 * Inline review panel (score header remains visible above).
 *
 * @param {{
 *   review: object,
 *   canVoteReview: boolean,
 *   hasVoted?: boolean,
 *   secondsRemaining: number,
 *   isRealtimeConnected: boolean,
 *   onVote: (vote: "fair" | "not_fair") => void,
 *   reduceMotion: boolean,
 *   panelRef?: import("react").RefObject<HTMLDivElement | null>,
 * }} props
 */
export function TabooReviewOverlay({
  review,
  canVoteReview,
  hasVoted = false,
  secondsRemaining,
  isRealtimeConnected,
  onVote,
  reduceMotion,
  panelRef,
}) {
  if (!review || review.status !== "in_progress") return null;

  const calledBy = review.tabooCalledBy?.playerName || "Opponent";
  const penalizedLabel = review.penalizedTeam === "B" ? "Beta" : "Alpha";
  const votingTeamLabel =
    review.votingTeam === "B" ? "Beta" : review.votingTeam === "A" ? "Alpha" : penalizedLabel;
  const notFairCount = review.notFairCount ?? 0;
  const fairCount = review.fairCount ?? 0;
  const eligibleCount = review.eligibleCount ?? 0;
  const votes = Array.isArray(review.votes) ? review.votes : [];

  const motionProps = reduceMotion ? {} : { ...motionPresets.modal };

  return (
    <motion.div ref={panelRef} role="region" aria-label="Taboo review in progress" tabIndex={-1} {...motionProps} className="mb-4">
      <div className="taboo-review-panel p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="taboo-text-micro text-taboo-text-faint">Taboo review</p>
            <h3 className="font-display text-lg font-bold text-taboo-text">Review in progress</h3>
            <p className="mt-1 text-xs text-taboo-text-muted">
              Called by {calledBy} · Team {penalizedLabel} penalized
            </p>
            {secondsRemaining > 0 ? (
              <p className="mt-1 text-xs font-medium text-taboo-accent">Voting ends in {secondsRemaining}s</p>
            ) : null}
          </div>
          <TabooChip className="border border-taboo-border bg-white/[0.05]">
            {notFairCount} not fair · {fairCount} fair
          </TabooChip>
        </div>

        {review.tabooCard ? (
          <div className="mb-4 rounded-xl border border-taboo-border bg-white/[0.03] p-4">
            <p className="mb-2 taboo-text-micro text-taboo-text-faint">Card under review</p>
            <h4 className="mb-3 text-center font-display text-2xl font-bold text-taboo-text">
              {review.tabooCard.question}
            </h4>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(review.tabooCard.taboo || []).map((word) => (
                <span key={word} className="taboo-forbidden-chip">
                  {word}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {canVoteReview ? (
          <div className="mb-3 flex gap-2">
            <TabooButton
              variant="voteFair"
              onClick={() => onVote("fair")}
              disabled={!isRealtimeConnected || hasVoted}
            >
              Vote Fair
            </TabooButton>
            <TabooButton
              variant="voteNotFair"
              onClick={() => onVote("not_fair")}
              disabled={!isRealtimeConnected || hasVoted}
            >
              Vote Not Fair
            </TabooButton>
          </div>
        ) : (
          <p className="mb-3 text-center text-sm text-taboo-text-muted">
            {hasVoted ? "Vote recorded — waiting for others…" : "Waiting for votes…"}
          </p>
        )}

        <p className="mb-1 text-center text-xs text-taboo-text-muted">
          Team {votingTeamLabel} votes · {eligibleCount} player{eligibleCount === 1 ? "" : "s"}
        </p>
        <p className="mb-4 text-center text-[11px] text-taboo-text-faint">
          Majority &quot;not fair&quot; reverses the −1 penalty. Ties keep the penalty.
          {eligibleCount > 0 && review.votesNeededToRevert ? (
            <> ({review.votesNeededToRevert} of {eligibleCount} must vote not fair)</>
          ) : null}
        </p>

        {votes.length > 0 ? (
          <div className="rounded-xl border border-taboo-border-subtle bg-black/20 p-3">
            <p className="mb-2 taboo-text-micro text-taboo-text-faint">Votes</p>
            <ul className="space-y-1.5 text-xs">
              {votes.map((voteEntry) => (
                <li key={voteEntry.playerId} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-taboo-text">{voteEntry.playerName || "Player"}</span>
                  <span
                    className={cn(
                      "font-semibold capitalize",
                      voteEntry.vote === "not_fair"
                        ? "text-taboo-danger-text"
                        : voteEntry.vote === "fair"
                          ? "text-taboo-success"
                          : "text-taboo-text-faint",
                    )}
                  >
                    {voteEntry.vote ? voteEntry.vote.replace("_", " ") : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
