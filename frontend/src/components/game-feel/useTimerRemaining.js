import { useEffect, useRef, useState } from "react";

/**
 * @param {{
 *   endsAt: number,
 *   serverOffsetMs?: number,
 *   now?: number,
 *   warnAtSeconds?: number,
 *   totalSeconds?: number,
 *   alreadyWarned?: boolean,
 * }} params
 */
export function computeTimerSnapshot({
  endsAt,
  serverOffsetMs = 0,
  now = Date.now(),
  warnAtSeconds = 10,
  totalSeconds,
  alreadyWarned = false,
}) {
  const remainingMs = Math.max(0, endsAt - (now + serverOffsetMs));
  const secondsRemaining = Math.ceil(remainingMs / 1000);
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= warnAtSeconds;
  const warnAnnounced = isUrgent && !alreadyWarned;
  const total =
    typeof totalSeconds === "number" && totalSeconds > 0
      ? totalSeconds
      : Math.max(secondsRemaining, 1);
  const percent = total > 0 ? Math.max(0, Math.min(100, (secondsRemaining / total) * 100)) : 0;
  return { secondsRemaining, percent, isUrgent, warnAnnounced };
}

/**
 * Server-aligned countdown from an absolute end timestamp.
 *
 * @param {{
 *   endsAt?: number | null,
 *   serverOffsetMs?: number,
 *   warnAtSeconds?: number,
 *   totalSeconds?: number,
 *   tickMs?: number,
 * }} options
 */
export function useTimerRemaining({
  endsAt = null,
  serverOffsetMs = 0,
  warnAtSeconds = 10,
  totalSeconds,
  tickMs = 250,
}) {
  const [snapshot, setSnapshot] = useState({
    secondsRemaining: 0,
    percent: 0,
    isUrgent: false,
    warnAnnounced: false,
  });
  const warnedRef = useRef(false);
  const prevEndsAtRef = useRef(endsAt);

  useEffect(() => {
    if (endsAt !== prevEndsAtRef.current) {
      prevEndsAtRef.current = endsAt;
      warnedRef.current = false;
    }
  }, [endsAt]);

  useEffect(() => {
    if (typeof endsAt !== "number" || !Number.isFinite(endsAt)) {
      setSnapshot({ secondsRemaining: 0, percent: 0, isUrgent: false, warnAnnounced: false });
      return undefined;
    }

    const tick = () => {
      const snap = computeTimerSnapshot({
        endsAt,
        serverOffsetMs,
        warnAtSeconds,
        totalSeconds,
        alreadyWarned: warnedRef.current,
      });
      if (snap.warnAnnounced) warnedRef.current = true;
      setSnapshot({
        secondsRemaining: snap.secondsRemaining,
        percent: snap.percent,
        isUrgent: snap.isUrgent,
        warnAnnounced: snap.warnAnnounced,
      });
    };

    tick();
    const id = setInterval(tick, tickMs);
    return () => clearInterval(id);
  }, [endsAt, serverOffsetMs, warnAtSeconds, totalSeconds, tickMs]);

  return snapshot;
}
