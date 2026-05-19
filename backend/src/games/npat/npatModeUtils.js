/** Canonical free-for-all mode key (legacy API alias: `solo`). */
export const NPAT_MODE_FREE_FOR_ALL = 'free-for-all';

export const NPAT_MODE_TEAM = 'team';

/**
 * @param {string | undefined | null} mode
 * @returns {'free-for-all' | 'team'}
 */
export function normalizeNpatMode(mode) {
  if (mode === NPAT_MODE_TEAM) return NPAT_MODE_TEAM;
  if (mode === 'solo' || mode === NPAT_MODE_FREE_FOR_ALL) return NPAT_MODE_FREE_FOR_ALL;
  return NPAT_MODE_FREE_FOR_ALL;
}

/**
 * @param {string | undefined | null} mode
 */
export function isFreeForAllMode(mode) {
  return normalizeNpatMode(mode) === NPAT_MODE_FREE_FOR_ALL;
}

/**
 * @param {{ rounds?: Array<{ evaluationSource?: string }> } | null | undefined} results
 * @returns {'gemini' | 'fallback' | null}
 */
export function resolveGameEvaluationSource(results) {
  const rounds = results?.rounds ?? [];
  if (rounds.some((r) => r.evaluationSource === 'gemini')) return 'gemini';
  if (rounds.some((r) => r.evaluationSource === 'fallback')) return 'fallback';
  return null;
}
