/**
 * Cross-tab mutex for POST /auth/refresh when Web Locks API is unavailable.
 * All localStorage access is wrapped: Safari private mode and strict storage policies can throw.
 */

const LOCK_STORAGE_KEY = "playgrounds:auth-refresh-lock";
const LOCK_TIMEOUT_MS = 10_000;

function acquireStorageLock() {
  if (typeof localStorage === "undefined") return true;
  try {
    const now = Date.now();
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (raw) {
      try {
        const lock = JSON.parse(raw);
        if (lock.ts && now - lock.ts < LOCK_TIMEOUT_MS) {
          return false;
        }
      } catch {
        /* stale */
      }
    }
    localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify({ ts: now, tab: Math.random() }));
    return true;
  } catch {
    return true;
  }
}

function releaseStorageLock() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOCK_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

/**
 * @template T
 * @param {() => Promise<T>} requestFn
 * @returns {Promise<T>}
 */
export async function withRefreshStorageLock(requestFn) {
  const maxWait = LOCK_TIMEOUT_MS + 2000;
  const start = Date.now();
  while (!acquireStorageLock()) {
    if (Date.now() - start > maxWait) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  try {
    return await requestFn();
  } finally {
    releaseStorageLock();
  }
}
