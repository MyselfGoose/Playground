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
  unhandled_rejection: 0,
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
  const mem = process.memoryUsage();
  return {
    counters: { ...counters },
    mongoReadyState: mongoose.connection.readyState,
    uptime: process.uptime(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
  };
}

/**
 * Export metrics in Prometheus text exposition format for external scraping.
 * @returns {string}
 */
export function getPrometheusMetrics() {
  const lines = [];
  const mem = process.memoryUsage();

  for (const [name, value] of Object.entries(counters)) {
    lines.push(`# TYPE playground_${name} counter`);
    lines.push(`playground_${name} ${value}`);
  }

  lines.push(`# TYPE playground_uptime_seconds gauge`);
  lines.push(`playground_uptime_seconds ${process.uptime().toFixed(1)}`);

  lines.push(`# TYPE playground_memory_rss_bytes gauge`);
  lines.push(`playground_memory_rss_bytes ${mem.rss}`);

  lines.push(`# TYPE playground_memory_heap_used_bytes gauge`);
  lines.push(`playground_memory_heap_used_bytes ${mem.heapUsed}`);

  lines.push(`# TYPE playground_memory_heap_total_bytes gauge`);
  lines.push(`playground_memory_heap_total_bytes ${mem.heapTotal}`);

  lines.push(`# TYPE playground_mongo_ready_state gauge`);
  lines.push(`playground_mongo_ready_state ${mongoose.connection.readyState}`);

  return lines.join('\n') + '\n';
}
