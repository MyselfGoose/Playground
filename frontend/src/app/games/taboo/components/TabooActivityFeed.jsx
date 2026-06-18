"use client";

import { AlertTriangle, CheckCircle2, Clock, MessageCircle, SkipForward, Users, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {object} entry
 * @returns {{ icon: import("react").ReactNode, text: string, color: string } | null}
 */
function formatEntry(entry) {
  const name = entry.playerName || "Player";

  if (entry.action === "submit_guess" && entry.matched) {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-taboo-success" />,
      text: `${name} guessed correctly!`,
      color: "text-taboo-success",
    };
  }
  if (entry.action === "submit_guess") {
    return {
      icon: <XCircle className="h-3.5 w-3.5 shrink-0 text-taboo-text-faint" />,
      text: `${name}: "${entry.guess ?? ""}"`,
      color: "text-taboo-text-muted",
    };
  }
  if (entry.action === "close_guess") {
    return {
      icon: <MessageCircle className="h-3.5 w-3.5 shrink-0 text-taboo-warning" />,
      text: `${name}: close guess "${entry.guess ?? ""}"`,
      color: "text-taboo-warning",
    };
  }
  if (entry.action === "skip_card") {
    return {
      icon: <SkipForward className="h-3.5 w-3.5 shrink-0 text-taboo-warning" />,
      text: `${name} skipped the card`,
      color: "text-taboo-warning",
    };
  }
  if (entry.action === "taboo_called") {
    return {
      icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-taboo-danger" />,
      text: `Taboo! −1 for Team ${entry.penalizedTeam === "B" ? "Beta" : "Alpha"}`,
      color: "text-taboo-danger-text",
    };
  }
  if (entry.action === "turn_timeout") {
    return {
      icon: <Clock className="h-3.5 w-3.5 shrink-0 text-taboo-text-faint" />,
      text: "Time's up!",
      color: "text-taboo-text-muted",
    };
  }
  if (entry.action === "review_vote") {
    const voteLabel = entry.vote === "fair" ? "fair" : entry.vote === "not_fair" ? "not fair" : String(entry.vote);
    return {
      icon: <Users className="h-3.5 w-3.5 shrink-0 text-taboo-accent" />,
      text: `${name} voted ${voteLabel}`,
      color: "text-taboo-accent",
    };
  }
  if (entry.action === "review_resolved") {
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-taboo-accent" />,
      text: "Review resolved",
      color: "text-taboo-text-muted",
    };
  }
  if (entry.action === "review_requested") {
    return {
      icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-taboo-team-a-text" />,
      text: `${name} requested a review`,
      color: "text-taboo-team-a-text",
    };
  }

  if (!entry.action) return null;

  const label = String(entry.action).replace(/_/g, " ");
  return {
    icon: <Clock className="h-3.5 w-3.5 shrink-0 text-taboo-text-faint" />,
    text: entry.playerName ? `${name}: ${label}` : label,
    color: "text-taboo-text-faint",
  };
}

/**
 * @param {{
 *   history?: Array<object>,
 * }} props
 */
export function TabooActivityFeed({ history }) {
  const feedRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const stickToBottomRef = useRef(true);
  const prevCountRef = useRef(0);

  const entries = (history || []).filter((entry) => formatEntry(entry) !== null);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 48;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;

    const grew = entries.length > prevCountRef.current;
    prevCountRef.current = entries.length;

    if (grew && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries.length]);

  return (
    <div className="mt-4">
      <p className="mb-2 taboo-text-micro text-taboo-text-faint">Activity log</p>
      <div
        ref={feedRef}
        className="max-h-[min(280px,40dvh)] overflow-y-auto rounded-xl border border-taboo-border taboo-surface-inset px-3 py-2"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-taboo-text-faint">Game events will appear here.</p>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry, idx) => {
              const formatted = formatEntry(entry);
              if (!formatted) return null;
              const key = `${entry.at ?? idx}-${entry.action}-${entry.playerId ?? "sys"}-${idx}`;

              return (
                <li key={key} className={cn("flex items-center gap-2 py-1 text-xs", formatted.color)}>
                  {formatted.icon}
                  <span className="min-w-0 flex-1 break-words">{formatted.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
