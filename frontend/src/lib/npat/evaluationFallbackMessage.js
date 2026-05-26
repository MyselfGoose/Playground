/**
 * User-safe copy when NPAT fell back to rules-based scoring.
 * @param {string | null | undefined} failureClass
 * @returns {string | null}
 */
export function npatFallbackReasonMessage(failureClass) {
  if (!failureClass || typeof failureClass !== 'string') return null;
  switch (failureClass) {
    case 'auth':
      return 'AI scoring is unavailable due to server configuration. Showing rule-based scores.';
    case 'model_not_found':
    case 'invalid_model':
    case 'provider_error':
      return 'AI scoring is temporarily unavailable. Showing rule-based scores.';
    case 'timeout':
    case 'rate_limit':
      return 'AI scoring timed out. Showing rule-based scores.';
    case 'quota':
      return 'AI scoring quota was exceeded. Showing rule-based scores.';
    case 'parse_error':
    case 'schema_error':
    case 'integrity_error':
      return 'AI could not process this game’s answers. Showing rule-based scores.';
    default:
      return 'AI scoring could not complete. Showing rule-based scores.';
  }
}

/**
 * @param {Array<Record<string, unknown>> | null | undefined} rounds
 * @returns {string | null | undefined}
 */
export function resolveNpatGameFailureClass(rounds) {
  if (!Array.isArray(rounds)) return null;
  for (const round of rounds) {
    const fc = round?.evaluationFailureClass;
    if (typeof fc === 'string' && fc.trim()) return fc;
  }
  return null;
}
