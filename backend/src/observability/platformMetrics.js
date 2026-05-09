/**
 * Lightweight in-process counters for ops dashboards (plan observability todo).
 * Replace with Prometheus/OpenTelemetry when available.
 */

import mongoose from 'mongoose';

/** @type {Record<string, number>} */
const counters = {
  auth_refresh_ok: 0,
  auth_refresh_fail: 0,
  auth_refresh_grace_ok: 0,
  socket_handshake_ok: 0,
  socket_handshake_fail: 0,
  leaderboard_cron_complete: 0,
};

/**
 * @param {string} name
 * @param {number} [delta]
 */
export function bumpMetric(name, delta = 1) {
  counters[name] = (counters[name] ?? 0) + delta;
}

/**
 * @param {{ ok: boolean, grace?: boolean }} param
 */
export function recordAuthRefresh({ ok, grace = false }) {
  if (ok) {
    bumpMetric('auth_refresh_ok');
    if (grace) bumpMetric('auth_refresh_grace_ok');
  } else {
    bumpMetric('auth_refresh_fail');
  }
}

export function getPlatformMetrics() {
  return {
    counters: { ...counters },
    mongoReadyState: mongoose.connection.readyState,
  };
}
