import { useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 650;

function lastEntrySignature(entry) {
  if (!entry) return "";
  return `${entry.at}|${entry.action}|${entry.playerId || ""}|${entry.guess || ""}|${entry.matched === true ? "1" : "0"}`;
}

export function useGameFeedback({ history, review, gameStatus, reduceMotion }) {
  const [variant, setVariant] = useState(null);
  const lastEntrySigRef = useRef("");
  const historyPrimedRef = useRef(false);
  const prevReviewOutcomeRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (reduceMotion || gameStatus === "finished") return;
    const list = Array.isArray(history) ? history : [];
    if (!list.length) return;
    const last = list[list.length - 1];
    const sig = lastEntrySignature(last);
    if (!sig) return;
    if (!historyPrimedRef.current) {
      historyPrimedRef.current = true;
      lastEntrySigRef.current = sig;
      return;
    }
    if (sig === lastEntrySigRef.current) return;
    lastEntrySigRef.current = sig;
    let next = null;
    if (last.action === "submit_guess" && last.matched) next = "correct";
    else if (last.action === "taboo_called") next = "taboo";
    else if (last.action === "close_guess") next = "close";
    else if (last.action === "skip_card") next = "skip";
    if (!next) return;
    setVariant(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVariant(null), FEEDBACK_MS);
  }, [history, gameStatus, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || gameStatus === "finished") return;
    const outcome = review?.outcome;
    if (!outcome || outcome === prevReviewOutcomeRef.current) {
      if (!outcome) prevReviewOutcomeRef.current = null;
      return;
    }
    prevReviewOutcomeRef.current = outcome;
    setVariant(outcome === "reverted" ? "review_reverted" : "review_upheld");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVariant(null), FEEDBACK_MS);
  }, [review?.outcome, gameStatus, reduceMotion]);

  return variant;
}
