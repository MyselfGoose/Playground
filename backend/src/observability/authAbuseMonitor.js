const MAX_IPS = 500;
const TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { loginFailures: number, rateLimitHits: number, lastSeenAt: number }>} */
const byIp = new Map();

/**
 * @param {string | undefined | null} ip
 */
function normalizeIp(ip) {
  const s = String(ip ?? '').trim();
  return s || 'unknown';
}

function pruneExpired() {
  const now = Date.now();
  for (const [ip, row] of byIp) {
    if (now - row.lastSeenAt > TTL_MS) {
      byIp.delete(ip);
    }
  }
  if (byIp.size <= MAX_IPS) return;
  const sorted = [...byIp.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
  const toRemove = sorted.length - MAX_IPS;
  for (let i = 0; i < toRemove; i += 1) {
    byIp.delete(sorted[i][0]);
  }
}

/**
 * @param {string | undefined | null} ip
 */
export function recordLoginFailure(ip) {
  const key = normalizeIp(ip);
  const now = Date.now();
  const row = byIp.get(key) ?? { loginFailures: 0, rateLimitHits: 0, lastSeenAt: now };
  row.loginFailures += 1;
  row.lastSeenAt = now;
  byIp.set(key, row);
  pruneExpired();
}

/**
 * @param {string | undefined | null} ip
 */
export function recordRateLimitHit(ip) {
  const key = normalizeIp(ip);
  const now = Date.now();
  const row = byIp.get(key) ?? { loginFailures: 0, rateLimitHits: 0, lastSeenAt: now };
  row.rateLimitHits += 1;
  row.lastSeenAt = now;
  byIp.set(key, row);
  pruneExpired();
}

/**
 * @param {{ limit?: number }} [opts]
 */
export function getAuthAbuseSnapshot(opts = {}) {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  pruneExpired();
  const rows = [...byIp.entries()].map(([ip, row]) => ({
    ip,
    loginFailures: row.loginFailures,
    rateLimitHits: row.rateLimitHits,
    lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    score: row.loginFailures * 2 + row.rateLimitHits,
  }));
  rows.sort((a, b) => b.score - a.score || b.lastSeenAt.localeCompare(a.lastSeenAt));
  return {
    perInstance: true,
    entries: rows.slice(0, limit),
    totalTrackedIps: rows.length,
  };
}

export function clearAuthAbuseMonitorForTests() {
  byIp.clear();
}
