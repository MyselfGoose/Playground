/** Derived-cache hooks register here so reconciliation can bust leaderboard/profile caches. */

const invalidators = new Set();

/**
 * @param {() => void} fn
 * @returns {() => void}
 */
export function registerDerivedCacheInvalidator(fn) {
  invalidators.add(fn);
  return () => invalidators.delete(fn);
}

export function invalidateDerivedCaches() {
  for (const fn of invalidators) {
    try {
      fn();
    } catch {
      // ignore individual hook failures
    }
  }
}
