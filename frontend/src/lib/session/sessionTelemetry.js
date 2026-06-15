/**
 * Lightweight client session telemetry for bootstrap and refresh flows.
 * Emits debug logs in development; no-op in production unless explicitly enabled.
 */

const ENABLED =
  typeof process !== "undefined" &&
  process.env.NODE_ENV !== "production";

/**
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
export function logSessionEvent(event, detail = {}) {
  if (!ENABLED) return;
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(`[session] ${event}`, detail);
  }
}
