const cache = new Map();
const CACHE_TTL = 45_000;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export { cacheGet, cacheSet, CACHE_TTL };

/**
 * @param {string} userId
 */
export function invalidateUserCaches(userId) {
  const prefix = `profile:${userId}:`;
  const matchPrefix = `matches:${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix) || key.startsWith(matchPrefix)) {
      cache.delete(key);
    }
  }
}
